import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ilikeMock, updateReadingStatusMock, rateBookMock, toggleBookFavoriteMock } = vi.hoisted(() => ({
  ilikeMock: vi.fn(),
  updateReadingStatusMock: vi.fn(),
  rateBookMock: vi.fn(),
  toggleBookFavoriteMock: vi.fn(),
}));

vi.mock('@/app/actions', () => ({
  updateReadingStatus: updateReadingStatusMock,
  rateBook: rateBookMock,
  toggleBookFavorite: toggleBookFavoriteMock,
}));

import { buildLibraryTools } from './tools';

const FAKE_OPTIONS = { toolCallId: 'test', messages: [] } as never;

function fakeSupabase() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          ilike: ilikeMock,
        }),
      }),
    }),
  } as never;
}

describe('buildLibraryTools', () => {
  beforeEach(() => {
    ilikeMock.mockReset();
    updateReadingStatusMock.mockReset();
    rateBookMock.mockReset();
    toggleBookFavoriteMock.mockReset();
  });

  describe('update_reading_status', () => {
    it('resolves the book by title and updates its status', async () => {
      ilikeMock.mockResolvedValue({ data: [{ id: 'book-1', title: 'Dom Casmurro' }] });
      updateReadingStatusMock.mockResolvedValue({ error: null });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.update_reading_status.execute!({ title: 'Dom Casmurro', status: 'lido' }, FAKE_OPTIONS);

      expect(updateReadingStatusMock).toHaveBeenCalledWith('book-1', 'lido');
      expect(result).toEqual({ ok: true, message: '"Dom Casmurro" atualizado para status "lido".' });
    });

    it('returns a not-found message without calling the update action', async () => {
      ilikeMock.mockResolvedValue({ data: [] });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.update_reading_status.execute!({ title: 'Livro Inexistente', status: 'lido' }, FAKE_OPTIONS);

      expect(updateReadingStatusMock).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, message: 'Nenhum livro encontrado com o título "Livro Inexistente".' });
    });

    it('returns an ambiguity message when multiple books match', async () => {
      ilikeMock.mockResolvedValue({
        data: [
          { id: 'book-1', title: 'Clean Code' },
          { id: 'book-2', title: 'Clean Coder' },
        ],
      });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.update_reading_status.execute!({ title: 'Clean', status: 'lendo' }, FAKE_OPTIONS);

      expect(updateReadingStatusMock).not.toHaveBeenCalled();
      expect((result as { ok: boolean; message: string }).message).toContain('Clean Code, Clean Coder');
    });

    it('passes through a DB error from the update action', async () => {
      ilikeMock.mockResolvedValue({ data: [{ id: 'book-1', title: 'Dom Casmurro' }] });
      updateReadingStatusMock.mockResolvedValue({ error: 'db down' });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.update_reading_status.execute!({ title: 'Dom Casmurro', status: 'lido' }, FAKE_OPTIONS);

      expect(result).toEqual({ ok: false, message: 'db down' });
    });
  });

  describe('rate_book', () => {
    it('resolves the book by title and sets the rating', async () => {
      ilikeMock.mockResolvedValue({ data: [{ id: 'book-1', title: 'Dom Casmurro' }] });
      rateBookMock.mockResolvedValue({ error: null });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.rate_book.execute!({ title: 'Dom Casmurro', rating: 5 }, FAKE_OPTIONS);

      expect(rateBookMock).toHaveBeenCalledWith('book-1', 5);
      expect(result).toEqual({ ok: true, message: '"Dom Casmurro" avaliado com nota 5.' });
    });
  });

  describe('toggle_favorite', () => {
    it('resolves the book by title and toggles favorite', async () => {
      ilikeMock.mockResolvedValue({ data: [{ id: 'book-1', title: 'Dom Casmurro' }] });
      toggleBookFavoriteMock.mockResolvedValue({ error: null });

      const tools = buildLibraryTools(fakeSupabase(), 'user-1');
      const result = await tools.toggle_favorite.execute!({ title: 'Dom Casmurro', favorite: true }, FAKE_OPTIONS);

      expect(toggleBookFavoriteMock).toHaveBeenCalledWith('book-1', true);
      expect(result).toEqual({ ok: true, message: '"Dom Casmurro" marcado como favorito.' });
    });
  });
});
