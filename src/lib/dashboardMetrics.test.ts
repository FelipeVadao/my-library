import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Book, ReadingStatus } from './supabase/types';
import {
  formatDailyData,
  formatGenreMonthHeatmap,
  formatRatingDistribution,
  buildAlerts,
  buildRecommendations,
  buildLoanedBooks,
} from './dashboardMetrics';

const FROZEN_NOW = '2026-07-15T12:00:00.000Z';

let idCounter = 0;

function makeBook(overrides: Partial<Book> = {}): Book {
  idCounter += 1;
  return {
    id: `book-${idCounter}`,
    operator_id: 'user-1',
    isbn: null,
    title: `Book ${idCounter}`,
    author: null,
    publisher: null,
    published_year: null,
    genre: null,
    synopsis: null,
    reader_summary: null,
    cover_url: null,
    copies: 1,
    reading_status: 'quero_ler' as ReadingStatus,
    rating: null,
    finished_at: null,
    loaned_to: null,
    loaned_at: null,
    favorite: false,
    started_at: null,
    page_count: null,
    current_page: null,
    language: null,
    added_at: FROZEN_NOW,
    updated_at: FROZEN_NOW,
    ...overrides,
  };
}

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

describe('formatDailyData', () => {
  it('formats raw {date, count} entries as dd/mm pt-BR, preserving order', () => {
    const format = (d: string) =>
      new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

    expect(formatDailyData([
      { date: '2026-01-03', count: 2 },
      { date: '2026-01-05', count: 1 },
    ])).toEqual([
      { date: format('2026-01-03'), count: 2 },
      { date: format('2026-01-05'), count: 1 },
    ]);
  });

  it('returns an empty array for no entries', () => {
    expect(formatDailyData([])).toEqual([]);
  });
});

describe('formatGenreMonthHeatmap', () => {
  it('formats YYYY-MM month keys into pt-BR short month labels, passing genres/matrix through', () => {
    const format = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });

    const result = formatGenreMonthHeatmap({
      genres: ['Ficção', 'Fantasia'],
      months: ['2026-05', '2026-06'],
      matrix: [[1, 2], [3, 4]],
    });

    expect(result.genres).toEqual(['Ficção', 'Fantasia']);
    expect(result.matrix).toEqual([[1, 2], [3, 4]]);
    expect(result.months).toEqual([format(2026, 5), format(2026, 6)]);
  });
});

describe('formatRatingDistribution', () => {
  it('maps numeric star buckets to "N★" labels', () => {
    expect(formatRatingDistribution([
      { star: 1, count: 0 },
      { star: 2, count: 0 },
      { star: 3, count: 1 },
      { star: 4, count: 0 },
      { star: 5, count: 2 },
    ])).toEqual([
      { label: '1★', count: 0 },
      { label: '2★', count: 0 },
      { label: '3★', count: 1 },
      { label: '4★', count: 0 },
      { label: '5★', count: 2 },
    ]);
  });
});

describe('buildAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only alerts on "lendo" books stalled for 30+ days, with severity thresholds', () => {
    const books = [
      makeBook({ title: 'Too recent', reading_status: 'lendo', updated_at: daysAgoISO(20) }),
      makeBook({ title: 'Medium', reading_status: 'lendo', updated_at: daysAgoISO(30) }),
      makeBook({ title: 'Severe', reading_status: 'lendo', updated_at: daysAgoISO(65) }),
      makeBook({ title: 'Not reading', reading_status: 'lido', updated_at: daysAgoISO(90) }),
    ];

    const alerts = buildAlerts(books);

    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ title: 'Severe', severity: 'alta' });
    expect(alerts[1]).toMatchObject({ title: 'Medium', severity: 'media' });
  });

  it('caps at 8 alerts, sorted by days stalled descending', () => {
    const books = Array.from({ length: 10 }, (_, i) =>
      makeBook({ title: `Book ${i}`, reading_status: 'lendo', updated_at: daysAgoISO(30 + i) })
    );

    const alerts = buildAlerts(books);

    expect(alerts).toHaveLength(8);
    expect(alerts[0].title).toBe('Book 9');
  });
});

describe('buildLoanedBooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only includes books with a loaned_to set', () => {
    const books = [
      makeBook({ title: 'Not loaned', loaned_to: null }),
      makeBook({ title: 'Loaned', loaned_to: 'Maria', loaned_at: daysAgoISO(10) }),
    ];

    const loaned = buildLoanedBooks(books);

    expect(loaned).toHaveLength(1);
    expect(loaned[0].title).toBe('Loaned');
  });

  it('applies the 60-day severity threshold and includes the borrower name and day count in the reason', () => {
    const books = [
      makeBook({ title: 'Recent loan', loaned_to: 'João', loaned_at: daysAgoISO(10) }),
      makeBook({ title: 'Old loan', loaned_to: 'Ana', loaned_at: daysAgoISO(65) }),
    ];

    const loaned = buildLoanedBooks(books);
    const recent = loaned.find((l) => l.title === 'Recent loan');
    const old = loaned.find((l) => l.title === 'Old loan');

    expect(recent).toMatchObject({ severity: 'media' });
    expect(recent?.reason).toBe('Emprestado para João há 10 dia(s).');
    expect(old).toMatchObject({ severity: 'alta' });
    expect(old?.reason).toBe('Emprestado para Ana há 65 dia(s).');
  });

  it('sorts by days loaned descending and caps at 8', () => {
    const books = Array.from({ length: 10 }, (_, i) =>
      makeBook({ title: `Book ${i}`, loaned_to: `Pessoa ${i}`, loaned_at: daysAgoISO(i) })
    );

    const loaned = buildLoanedBooks(books);

    expect(loaned).toHaveLength(8);
    expect(loaned[0].title).toBe('Book 9');
  });

  it('treats a missing loaned_at as 0 days', () => {
    const books = [makeBook({ title: 'No date', loaned_to: 'Carlos', loaned_at: null })];
    const loaned = buildLoanedBooks(books);
    expect(loaned[0].reason).toBe('Emprestado para Carlos há 0 dia(s).');
  });
});

describe('buildRecommendations', () => {
  it('recommends picking a next book when the "quero ler" queue is 5+', () => {
    const recs = buildRecommendations({
      queroLerCount: 5,
      topLidoGenre: null,
      unratedReadCount: 0,
      dailyData: [{ date: '2026-07-01', count: 1 }],
    });
    expect(recs).toContain('Você tem 5 livros na fila "quero ler" — que tal escolher o próximo?');
  });

  it('surfaces the favorite genre among read books', () => {
    const recs = buildRecommendations({
      queroLerCount: 0,
      topLidoGenre: { genre: 'Ficção', count: 2 },
      unratedReadCount: 0,
      dailyData: [{ date: '2026-07-01', count: 1 }],
    });
    expect(recs.some((r) => r.includes('Ficção'))).toBe(true);
  });

  it('flags read books missing a rating', () => {
    const recs = buildRecommendations({
      queroLerCount: 0,
      topLidoGenre: null,
      unratedReadCount: 1,
      dailyData: [{ date: '2026-07-01', count: 1 }],
    });
    expect(recs).toContain('1 livro(s) lido(s) sem avaliação — vale registrar sua nota.');
  });

  it('notes when nothing was added in the last 30 days', () => {
    const recs = buildRecommendations({
      queroLerCount: 0,
      topLidoGenre: null,
      unratedReadCount: 0,
      dailyData: [],
    });
    expect(recs).toContain('Nenhum livro adicionado nos últimos 30 dias.');
  });

  it('returns no recommendations when no condition triggers', () => {
    const recs = buildRecommendations({
      queroLerCount: 0,
      topLidoGenre: null,
      unratedReadCount: 0,
      dailyData: [{ date: '2026-07-01', count: 1 }],
    });
    expect(recs).toEqual([]);
  });
});
