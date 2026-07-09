import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserMock, buildBooksQueryMock, answerLibraryQuestionMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  buildBooksQueryMock: vi.fn(),
  answerLibraryQuestionMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock('@/lib/bookQuery', () => ({
  buildBooksQuery: buildBooksQueryMock,
}));

vi.mock('@services/ai/gemini.service', () => ({
  answerLibraryQuestion: answerLibraryQuestionMock,
}));

import { askLibraryAssistant } from './actions';

describe('askLibraryAssistant', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    buildBooksQueryMock.mockReset();
    answerLibraryQuestionMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    buildBooksQueryMock.mockResolvedValue({ data: [], count: 0, error: null });
    answerLibraryQuestionMock.mockResolvedValue({ answer: 'resposta', error: null });
  });

  it('returns a validation error without querying anything for a blank question', async () => {
    const result = await askLibraryAssistant('   ');

    expect(result).toEqual({ answer: null, error: 'Digite uma pergunta.' });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('returns "Não autenticado." without fetching books when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: null, error: 'Não autenticado.' });
    expect(buildBooksQueryMock).not.toHaveBeenCalled();
  });

  it('returns a friendly error when the books query fails', async () => {
    buildBooksQueryMock.mockResolvedValue({ data: null, count: null, error: { message: 'db down' } });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: null, error: 'Não foi possível carregar sua biblioteca.' });
    expect(answerLibraryQuestionMock).not.toHaveBeenCalled();
  });

  it('fetches books scoped to the authenticated user and forwards the answer', async () => {
    const books = [{ title: 'Dom Casmurro', reading_status: 'lido' }];
    buildBooksQueryMock.mockResolvedValue({ data: books, count: 1, error: null });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(buildBooksQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { limit: 2000 },
      expect.objectContaining({ count: 'exact' })
    );
    expect(answerLibraryQuestionMock).toHaveBeenCalledWith(
      'quantos livros eu tenho?',
      expect.any(String),
      [],
      expect.any(Object)
    );
    expect(result).toEqual({ answer: 'resposta', error: null });

    const forwardedTools = answerLibraryQuestionMock.mock.calls[0][3];
    expect(Object.keys(forwardedTools)).toEqual(['update_reading_status', 'rate_book', 'toggle_favorite']);
  });

  it('caps forwarded history to the most recent messages', async () => {
    const longHistory = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `mensagem ${i}`,
    }));

    await askLibraryAssistant('pergunta nova', longHistory);

    const forwardedHistory = answerLibraryQuestionMock.mock.calls[0][2];
    expect(forwardedHistory).toHaveLength(10);
    expect(forwardedHistory[0].content).toBe('mensagem 5');
  });
});
