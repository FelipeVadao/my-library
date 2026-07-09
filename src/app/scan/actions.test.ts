import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APICallError } from 'ai';

const { getUserMock, generateTextMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: generateTextMock };
});

import { identifyBookFromCover } from './actions';

const FAKE_IMAGE = 'data:image/jpeg;base64,AAAA';

function apiError(statusCode: number) {
  return new APICallError({
    message: 'gateway error',
    url: 'https://ai-gateway.vercel.sh/v1/chat',
    requestBodyValues: {},
    statusCode,
  });
}

describe('identifyBookFromCover', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    generateTextMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('returns "Não autenticado." without calling generateText when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await identifyBookFromCover(FAKE_IMAGE);

    expect(result).toEqual({ title: null, author: null, confidence: 'low', error: 'Não autenticado.' });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('rejects a non-data-image URL without calling generateText', async () => {
    const result = await identifyBookFromCover('not-an-image');

    expect(result.error).toBe('Imagem inválida.');
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('returns the identified title/author/confidence on success', async () => {
    generateTextMock.mockResolvedValue({
      output: { title: 'Dom Casmurro', author: 'Machado de Assis', confidence: 'high' },
    });

    const result = await identifyBookFromCover(FAKE_IMAGE);

    expect(result).toEqual({ title: 'Dom Casmurro', author: 'Machado de Assis', confidence: 'high', error: null });
  });

  it('degrades gracefully with a quota message on a 402', async () => {
    generateTextMock.mockRejectedValue(apiError(402));

    const result = await identifyBookFromCover(FAKE_IMAGE);

    expect(result).toEqual({ title: null, author: null, confidence: 'low', error: 'Cota de IA esgotada.' });
  });

  it('degrades gracefully with a rate-limit message on a 429', async () => {
    generateTextMock.mockRejectedValue(apiError(429));

    const result = await identifyBookFromCover(FAKE_IMAGE);

    expect(result.error).toBe('Muitas requisições — tente novamente em instantes.');
  });

  it('degrades gracefully on an unexpected error', async () => {
    generateTextMock.mockRejectedValue(new Error('boom'));

    const result = await identifyBookFromCover(FAKE_IMAGE);

    expect(result).toEqual({
      title: null,
      author: null,
      confidence: 'low',
      error: 'Não foi possível identificar o livro pela capa.',
    });
  });
});
