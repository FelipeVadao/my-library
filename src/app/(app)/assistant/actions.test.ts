import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getUserMock,
  rpcMock,
  fromSelectMock,
  fromUpsertMock,
  buildBooksQueryMock,
  embedTextMock,
  embedManyTextsMock,
  bookToEmbeddingTextMock,
  answerLibraryQuestionMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  fromSelectMock: vi.fn(),
  fromUpsertMock: vi.fn(),
  buildBooksQueryMock: vi.fn(),
  embedTextMock: vi.fn(),
  embedManyTextsMock: vi.fn(),
  bookToEmbeddingTextMock: vi.fn(),
  answerLibraryQuestionMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            limit: fromSelectMock,
          }),
        }),
      }),
      upsert: fromUpsertMock,
    }),
  }),
}));

vi.mock('@/lib/bookQuery', () => ({
  buildBooksQuery: buildBooksQueryMock,
}));

vi.mock('@services/ai/embeddings', () => ({
  embedText: embedTextMock,
  embedManyTexts: embedManyTextsMock,
  bookToEmbeddingText: bookToEmbeddingTextMock,
}));

vi.mock('@services/ai/gemini.service', () => ({
  answerLibraryQuestion: answerLibraryQuestionMock,
}));

import { askLibraryAssistant } from './actions';

const DASHBOARD_METRICS = {
  totalBooks: 10,
  lidoCount: 4,
  lendoCount: 2,
  queroLerCount: 4,
  readThisYear: 3,
};

function rpcImplementation(overrides: { getDashboardMetrics?: unknown; matchBooks?: unknown } = {}) {
  return (name: string) => {
    if (name === 'get_dashboard_metrics') {
      return Promise.resolve(overrides.getDashboardMetrics ?? { data: DASHBOARD_METRICS, error: null });
    }
    if (name === 'match_books') {
      return Promise.resolve(overrides.matchBooks ?? { data: [], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };
}

describe('askLibraryAssistant', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    fromSelectMock.mockReset();
    fromUpsertMock.mockReset();
    buildBooksQueryMock.mockReset();
    embedTextMock.mockReset();
    embedManyTextsMock.mockReset();
    bookToEmbeddingTextMock.mockReset();
    answerLibraryQuestionMock.mockReset();

    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    rpcMock.mockImplementation(rpcImplementation());
    fromSelectMock.mockResolvedValue({ data: [], error: null }); // no missing embeddings by default
    fromUpsertMock.mockResolvedValue({ data: null, error: null });
    buildBooksQueryMock.mockResolvedValue({ data: [], count: 0, error: null });
    embedTextMock.mockResolvedValue(null); // defaults to the fallback path unless a test overrides
    embedManyTextsMock.mockResolvedValue([]);
    bookToEmbeddingTextMock.mockImplementation((b: { title: string }) => b.title);
    answerLibraryQuestionMock.mockResolvedValue({ answer: 'resposta', error: null });
  });

  it('returns a validation error without querying anything for a blank question', async () => {
    const result = await askLibraryAssistant('   ');

    expect(result).toEqual({ answer: null, error: 'Digite uma pergunta.' });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('returns "Não autenticado." without any further calls when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: null, error: 'Não autenticado.' });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(buildBooksQueryMock).not.toHaveBeenCalled();
  });

  it('uses RAG results when the question embeds and match_books returns rows', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2]);
    rpcMock.mockImplementation(
      rpcImplementation({ matchBooks: { data: [{ title: 'Dom Casmurro', reading_status: 'lido' }], error: null } })
    );

    const result = await askLibraryAssistant('livros sobre guerra?');

    expect(buildBooksQueryMock).not.toHaveBeenCalled();
    expect(result).toEqual({ answer: 'resposta', error: null });
    const forwardedContext = answerLibraryQuestionMock.mock.calls[0][1];
    expect(forwardedContext).toContain('RELEVANTES');
  });

  it('falls back to buildBooksQuery when the question embedding fails', async () => {
    embedTextMock.mockResolvedValue(null);
    buildBooksQueryMock.mockResolvedValue({
      data: [{ title: 'Dom Casmurro', reading_status: 'lido' }],
      count: 1,
      error: null,
    });

    await askLibraryAssistant('quantos livros eu tenho?');

    expect(rpcMock).not.toHaveBeenCalledWith('match_books', expect.anything());
    expect(buildBooksQueryMock).toHaveBeenCalled();
  });

  it('falls back to buildBooksQuery when match_books returns zero rows (not an empty-library signal)', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2]);
    rpcMock.mockImplementation(rpcImplementation({ matchBooks: { data: [], error: null } }));
    buildBooksQueryMock.mockResolvedValue({
      data: [{ title: 'Dom Casmurro', reading_status: 'lido' }],
      count: 1,
      error: null,
    });

    await askLibraryAssistant('quantos livros eu tenho?');

    expect(buildBooksQueryMock).toHaveBeenCalled();
  });

  it('falls back to buildBooksQuery when match_books errors', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2]);
    rpcMock.mockImplementation(rpcImplementation({ matchBooks: { data: null, error: { message: 'rpc down' } } }));

    await askLibraryAssistant('quantos livros eu tenho?');

    expect(buildBooksQueryMock).toHaveBeenCalled();
  });

  it('backfills missing embeddings before answering', async () => {
    fromSelectMock.mockResolvedValue({
      data: [{ id: 'book-1', title: 'Dom Casmurro', author: null, genre: null, synopsis: null }],
      error: null,
    });
    embedManyTextsMock.mockResolvedValue([[0.1, 0.2]]);

    await askLibraryAssistant('quantos livros eu tenho?');

    expect(embedManyTextsMock).toHaveBeenCalledWith(['Dom Casmurro']);
    expect(fromUpsertMock).toHaveBeenCalledWith(
      [{ id: 'book-1', operator_id: 'user-1', title: 'Dom Casmurro', embedding: [0.1, 0.2] }],
      { onConflict: 'id' }
    );
  });

  it('completes normally when the backfill select fails', async () => {
    fromSelectMock.mockResolvedValue({ data: null, error: { message: 'db down' } });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: 'resposta', error: null });
  });

  it('completes normally when embedManyTexts fails during backfill', async () => {
    fromSelectMock.mockResolvedValue({
      data: [{ id: 'book-1', title: 'Dom Casmurro', author: null, genre: null, synopsis: null }],
      error: null,
    });
    embedManyTextsMock.mockResolvedValue(null);

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(fromUpsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ answer: 'resposta', error: null });
  });

  it('completes normally when the backfill upsert fails', async () => {
    fromSelectMock.mockResolvedValue({
      data: [{ id: 'book-1', title: 'Dom Casmurro', author: null, genre: null, synopsis: null }],
      error: null,
    });
    embedManyTextsMock.mockResolvedValue([[0.1]]);
    fromUpsertMock.mockRejectedValue(new Error('upsert failed'));

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: 'resposta', error: null });
  });

  it('returns a friendly error when both stats and the fallback query fail', async () => {
    rpcMock.mockImplementation(rpcImplementation({ getDashboardMetrics: { data: null, error: { message: 'down' } } }));
    buildBooksQueryMock.mockResolvedValue({ data: null, count: null, error: { message: 'db down' } });

    const result = await askLibraryAssistant('quantos livros eu tenho?');

    expect(result).toEqual({ answer: null, error: 'Não foi possível carregar sua biblioteca.' });
    expect(answerLibraryQuestionMock).not.toHaveBeenCalled();
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

  it('forwards the assistant tools alongside the context', async () => {
    await askLibraryAssistant('quantos livros eu tenho?');

    const forwardedTools = answerLibraryQuestionMock.mock.calls[0][3];
    expect(Object.keys(forwardedTools)).toEqual(['update_reading_status', 'rate_book', 'toggle_favorite']);
  });
});
