import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Book, ReadingStatus } from './supabase/types';
import {
  startOfDay,
  daysAgo,
  buildDailyData,
  buildGenreMonthHeatmap,
  buildRatingDistribution,
  buildGenreDonut,
  buildTopAuthors,
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
    added_at: FROZEN_NOW,
    updated_at: FROZEN_NOW,
    ...overrides,
  };
}

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

describe('startOfDay', () => {
  it('zeroes out the time portion of the given date', () => {
    const result = new Date(startOfDay(new Date('2026-03-10T18:45:00')));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe('daysAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an ISO timestamp exactly n days before now', () => {
    expect(daysAgo(30)).toBe(daysAgoISO(30));
    expect(daysAgo(0)).toBe(FROZEN_NOW);
  });
});

describe('buildDailyData', () => {
  it('groups books by day, sorted ascending, formatted as dd/mm', () => {
    const books = [
      makeBook({ added_at: '2026-01-05T10:00:00.000Z' }),
      makeBook({ added_at: '2026-01-03T08:00:00.000Z' }),
      makeBook({ added_at: '2026-01-03T22:00:00.000Z' }),
    ];

    // Formatting goes through the local timezone (same as the implementation),
    // so derive the expected label the same way instead of hardcoding it.
    const format = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    expect(buildDailyData(books)).toEqual([
      { date: format('2026-01-03'), count: 2 },
      { date: format('2026-01-05'), count: 1 },
    ]);
  });

  it('returns an empty array for no books', () => {
    expect(buildDailyData([])).toEqual([]);
  });
});

describe('buildGenreMonthHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buckets books into a top-6-genre x trailing-6-month matrix', () => {
    function monthsAgoISO(n: number): string {
      const d = new Date();
      d.setMonth(d.getMonth() - n, 15);
      return d.toISOString();
    }

    const books = [
      makeBook({ genre: 'Ficção', added_at: monthsAgoISO(0) }),
      makeBook({ genre: 'Ficção', added_at: monthsAgoISO(0) }),
      makeBook({ genre: 'Ficção', added_at: monthsAgoISO(0) }),
      makeBook({ genre: 'Fantasia', added_at: monthsAgoISO(0) }),
      makeBook({ genre: 'Fantasia', added_at: monthsAgoISO(0) }),
      makeBook({ genre: 'Ficção', added_at: monthsAgoISO(2) }),
    ];

    const result = buildGenreMonthHeatmap(books);

    expect(result.months).toHaveLength(6);
    expect(result.genres).toEqual(['Ficção', 'Fantasia']);

    const currentMonthIdx = 5;
    const twoMonthsAgoIdx = 3;
    const ficcaoRow = result.matrix[result.genres.indexOf('Ficção')];
    const fantasiaRow = result.matrix[result.genres.indexOf('Fantasia')];

    expect(ficcaoRow[currentMonthIdx]).toBe(3);
    expect(ficcaoRow[twoMonthsAgoIdx]).toBe(1);
    expect(fantasiaRow[currentMonthIdx]).toBe(2);
  });

  it('ignores books without a genre and caps at the top 6 genres', () => {
    const genres = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const books = genres.flatMap((genre, i) =>
      Array.from({ length: genres.length - i }, () => makeBook({ genre }))
    );
    books.push(makeBook({ genre: null }));
    books.push(makeBook({ genre: '  ' }));

    const result = buildGenreMonthHeatmap(books);

    expect(result.genres).toHaveLength(6);
    expect(result.genres).not.toContain('G');
  });
});

describe('buildRatingDistribution', () => {
  it('buckets ratings 1-5 for read books only', () => {
    const books = [
      makeBook({ reading_status: 'lido', rating: 5 }),
      makeBook({ reading_status: 'lido', rating: 5 }),
      makeBook({ reading_status: 'lido', rating: 3 }),
      makeBook({ reading_status: 'lido', rating: null }),
      makeBook({ reading_status: 'lendo', rating: 4 }),
    ];

    expect(buildRatingDistribution(books)).toEqual([
      { stars: '1★', count: 0 },
      { stars: '2★', count: 0 },
      { stars: '3★', count: 1 },
      { stars: '4★', count: 0 },
      { stars: '5★', count: 2 },
    ]);
  });
});

describe('buildGenreDonut', () => {
  it('falls back to "Sem gênero" for missing/blank genre', () => {
    const books = [makeBook({ genre: null }), makeBook({ genre: '  ' }), makeBook({ genre: 'Ficção' })];
    const result = buildGenreDonut(books);

    expect(result).toEqual(
      expect.arrayContaining([
        { genre: 'Sem gênero', count: 2 },
        { genre: 'Ficção', count: 1 },
      ])
    );
  });

  it('aggregates genres beyond the top 6 into "Outros"', () => {
    const genres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const books = genres.flatMap((genre, i) =>
      Array.from({ length: genres.length - i }, () => makeBook({ genre }))
    );

    const result = buildGenreDonut(books);
    const outros = result.find((r) => r.genre === 'Outros');

    expect(result).toHaveLength(7);
    expect(outros?.count).toBe(2 + 1); // genres 'G' (count 2) and 'H' (count 1) fall outside the top 6
  });

  it('does not add "Outros" when there are 6 or fewer genres', () => {
    const books = ['A', 'B', 'C'].map((genre) => makeBook({ genre }));
    const result = buildGenreDonut(books);
    expect(result.find((r) => r.genre === 'Outros')).toBeUndefined();
  });
});

describe('buildTopAuthors', () => {
  it('ranks authors by book count, skipping blanks, capped at 10', () => {
    const books = [
      ...Array.from({ length: 3 }, () => makeBook({ author: 'Author A' })),
      ...Array.from({ length: 1 }, () => makeBook({ author: 'Author B' })),
      makeBook({ author: null }),
      makeBook({ author: '  ' }),
    ];

    expect(buildTopAuthors(books)).toEqual([
      { author: 'Author A', count: 3 },
      { author: 'Author B', count: 1 },
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
    const books = Array.from({ length: 5 }, () => makeBook({ reading_status: 'quero_ler' }));
    expect(buildRecommendations(books, [{ count: 1 }])).toContain(
      'Você tem 5 livros na fila "quero ler" — que tal escolher o próximo?'
    );
  });

  it('surfaces the favorite genre among read books', () => {
    const books = [
      makeBook({ reading_status: 'lido', genre: 'Ficção' }),
      makeBook({ reading_status: 'lido', genre: 'Ficção' }),
    ];
    const recs = buildRecommendations(books, [{ count: 1 }]);
    expect(recs.some((r) => r.includes('Ficção'))).toBe(true);
  });

  it('flags read books missing a rating', () => {
    const books = [makeBook({ reading_status: 'lido', rating: null })];
    const recs = buildRecommendations(books, [{ count: 1 }]);
    expect(recs).toContain('1 livro(s) lido(s) sem avaliação — vale registrar sua nota.');
  });

  it('notes when nothing was added in the last 30 days', () => {
    const recs = buildRecommendations([], []);
    expect(recs).toContain('Nenhum livro adicionado nos últimos 30 dias.');
  });

  it('returns no recommendations when no condition triggers', () => {
    const books = [makeBook({ reading_status: 'lendo' })];
    const recs = buildRecommendations(books, [{ count: 1 }]);
    expect(recs).toEqual([]);
  });
});
