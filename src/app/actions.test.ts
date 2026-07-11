import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpdateBookInput } from './actions';

const { eqMock, neqMock, updateMock, deleteMock, fromMock, revalidatePathMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const neqMock = vi.fn();
  const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqMock }));
  const deleteMock = vi.fn(() => ({ eq: eqMock, neq: neqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock, delete: deleteMock }));
  const revalidatePathMock = vi.fn();
  return { eqMock, neqMock, updateMock, deleteMock, fromMock, revalidatePathMock };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  updateReadingStatus,
  rateBook,
  toggleBookFavorite,
  updateBook,
  deleteBook,
  deleteAllBooks,
  markBookLoaned,
  clearLoan,
} from './actions';

const MINIMAL_UPDATE_INPUT: UpdateBookInput = {
  isbn: null,
  title: 'Dom Casmurro',
  author: null,
  publisher: null,
  published_year: null,
  genre: null,
  synopsis: null,
  reader_summary: null,
  cover_url: null,
  copies: 1,
  reading_status: 'quero_ler',
  rating: null,
  finished_at: null,
  loaned_to: null,
  loaned_at: null,
  favorite: false,
  started_at: null,
  page_count: null,
  current_page: null,
  language: null,
};

function expectRevalidated() {
  expect(revalidatePathMock).toHaveBeenCalledWith('/');
  expect(revalidatePathMock).toHaveBeenCalledWith('/analytics');
}

describe('updateReadingStatus', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets reading_status and a fresh finished_at when moving to "lido"', async () => {
    await updateReadingStatus('book-1', 'lido');

    expect(fromMock).toHaveBeenCalledWith('books');
    const payload = updateMock.mock.calls[0][0];
    expect(payload.reading_status).toBe('lido');
    expect(payload.finished_at).not.toBeNull();
    expect(eqMock).toHaveBeenCalledWith('id', 'book-1');
    expectRevalidated();
  });

  it('clears finished_at for non-"lido" statuses', async () => {
    await updateReadingStatus('book-1', 'lendo');

    const payload = updateMock.mock.calls[0][0];
    expect(payload.reading_status).toBe('lendo');
    expect(payload.finished_at).toBeNull();
  });

  it('passes through a DB error and skips revalidation', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });

    const result = await updateReadingStatus('book-1', 'lido');

    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('rateBook', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets the given rating', async () => {
    await rateBook('book-1', 4);
    expect(updateMock.mock.calls[0][0].rating).toBe(4);
    expectRevalidated();
  });

  it('clamps ratings above 5', async () => {
    await rateBook('book-1', 9);
    expect(updateMock.mock.calls[0][0].rating).toBe(5);
  });

  it('clamps ratings below 1', async () => {
    await rateBook('book-1', 0);
    expect(updateMock.mock.calls[0][0].rating).toBe(1);
  });

  it('passes through a DB error and skips revalidation', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await rateBook('book-1', 3);
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('toggleBookFavorite', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets favorite to true', async () => {
    await toggleBookFavorite('book-1', true);
    expect(updateMock.mock.calls[0][0].favorite).toBe(true);
    expectRevalidated();
  });

  it('sets favorite to false', async () => {
    await toggleBookFavorite('book-1', false);
    expect(updateMock.mock.calls[0][0].favorite).toBe(false);
  });

  it('passes through a DB error and skips revalidation', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await toggleBookFavorite('book-1', true);
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('updateBook', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('revalidates the dashboard and analytics on success', async () => {
    await updateBook('book-1', MINIMAL_UPDATE_INPUT);
    expectRevalidated();
  });

  it('rejects a blank title without touching the DB or revalidating', async () => {
    const result = await updateBook('book-1', { ...MINIMAL_UPDATE_INPUT, title: '   ' });
    expect(result).toEqual({ error: 'Título é obrigatório.' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('skips revalidation on a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await updateBook('book-1', MINIMAL_UPDATE_INPUT);
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('deleteBook', () => {
  beforeEach(() => {
    fromMock.mockClear();
    deleteMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('revalidates the dashboard and analytics on success', async () => {
    await deleteBook('book-1');
    expect(eqMock).toHaveBeenCalledWith('id', 'book-1');
    expectRevalidated();
  });

  it('skips revalidation on a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await deleteBook('book-1');
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('deleteAllBooks', () => {
  beforeEach(() => {
    fromMock.mockClear();
    deleteMock.mockClear();
    neqMock.mockReset();
    revalidatePathMock.mockClear();
    neqMock.mockResolvedValue({ error: null });
  });

  it('revalidates the dashboard and analytics on success', async () => {
    await deleteAllBooks();
    expectRevalidated();
  });

  it('skips revalidation on a DB error', async () => {
    neqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await deleteAllBooks();
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('markBookLoaned', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('revalidates the dashboard and analytics on success', async () => {
    await markBookLoaned('book-1', 'Alice');
    expect(updateMock.mock.calls[0][0].loaned_to).toBe('Alice');
    expectRevalidated();
  });

  it('skips revalidation on a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await markBookLoaned('book-1', 'Alice');
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('clearLoan', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    revalidatePathMock.mockClear();
    eqMock.mockResolvedValue({ error: null });
  });

  it('revalidates the dashboard and analytics on success', async () => {
    await clearLoan('book-1');
    expect(updateMock.mock.calls[0][0].loaned_to).toBeNull();
    expectRevalidated();
  });

  it('skips revalidation on a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await clearLoan('book-1');
    expect(result).toEqual({ error: 'db down' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
