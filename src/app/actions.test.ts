import { describe, it, expect, vi, beforeEach } from 'vitest';

const { eqMock, updateMock, fromMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { eqMock, updateMock, fromMock };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { updateReadingStatus, rateBook, toggleBookFavorite } from './actions';

describe('updateReadingStatus', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets reading_status and a fresh finished_at when moving to "lido"', async () => {
    await updateReadingStatus('book-1', 'lido');

    expect(fromMock).toHaveBeenCalledWith('books');
    const payload = updateMock.mock.calls[0][0];
    expect(payload.reading_status).toBe('lido');
    expect(payload.finished_at).not.toBeNull();
    expect(eqMock).toHaveBeenCalledWith('id', 'book-1');
  });

  it('clears finished_at for non-"lido" statuses', async () => {
    await updateReadingStatus('book-1', 'lendo');

    const payload = updateMock.mock.calls[0][0];
    expect(payload.reading_status).toBe('lendo');
    expect(payload.finished_at).toBeNull();
  });

  it('passes through a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });

    const result = await updateReadingStatus('book-1', 'lido');

    expect(result).toEqual({ error: 'db down' });
  });
});

describe('rateBook', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets the given rating', async () => {
    await rateBook('book-1', 4);
    expect(updateMock.mock.calls[0][0].rating).toBe(4);
  });

  it('clamps ratings above 5', async () => {
    await rateBook('book-1', 9);
    expect(updateMock.mock.calls[0][0].rating).toBe(5);
  });

  it('clamps ratings below 1', async () => {
    await rateBook('book-1', 0);
    expect(updateMock.mock.calls[0][0].rating).toBe(1);
  });

  it('passes through a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await rateBook('book-1', 3);
    expect(result).toEqual({ error: 'db down' });
  });
});

describe('toggleBookFavorite', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
  });

  it('sets favorite to true', async () => {
    await toggleBookFavorite('book-1', true);
    expect(updateMock.mock.calls[0][0].favorite).toBe(true);
  });

  it('sets favorite to false', async () => {
    await toggleBookFavorite('book-1', false);
    expect(updateMock.mock.calls[0][0].favorite).toBe(false);
  });

  it('passes through a DB error', async () => {
    eqMock.mockResolvedValue({ error: { message: 'db down' } });
    const result = await toggleBookFavorite('book-1', true);
    expect(result).toEqual({ error: 'db down' });
  });
});
