import { describe, it, expect, vi, beforeEach } from 'vitest';

const { embedMock, embedManyMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  embedManyMock: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, embed: embedMock, embedMany: embedManyMock };
});

import { bookToEmbeddingText, embedText, embedManyTexts } from './embeddings';

describe('bookToEmbeddingText', () => {
  it('joins all fields when present', () => {
    const text = bookToEmbeddingText({
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      genre: 'Romance',
      synopsis: 'A história de Bentinho e Capitu.',
    });
    expect(text).toBe('Dom Casmurro — Machado de Assis — Romance — A história de Bentinho e Capitu.');
  });

  it('skips null fields individually', () => {
    const text = bookToEmbeddingText({ title: 'Dom Casmurro', author: null, genre: 'Romance', synopsis: null });
    expect(text).toBe('Dom Casmurro — Romance');
  });

  it('handles a title-only book', () => {
    const text = bookToEmbeddingText({ title: 'Dom Casmurro', author: null, genre: null, synopsis: null });
    expect(text).toBe('Dom Casmurro');
  });
});

describe('embedText', () => {
  beforeEach(() => {
    embedMock.mockReset();
  });

  it('returns the embedding on success', async () => {
    embedMock.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
    const result = await embedText('Dom Casmurro');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns null when the call rejects', async () => {
    embedMock.mockRejectedValue(new Error('gateway down'));
    const result = await embedText('Dom Casmurro');
    expect(result).toBeNull();
  });

  it('returns null for blank input without calling embed', async () => {
    const result = await embedText('   ');
    expect(result).toBeNull();
    expect(embedMock).not.toHaveBeenCalled();
  });
});

describe('embedManyTexts', () => {
  beforeEach(() => {
    embedManyMock.mockReset();
  });

  it('returns embeddings in order on success', async () => {
    embedManyMock.mockResolvedValue({ embeddings: [[0.1], [0.2]] });
    const result = await embedManyTexts(['a', 'b']);
    expect(result).toEqual([[0.1], [0.2]]);
  });

  it('returns null when the call rejects', async () => {
    embedManyMock.mockRejectedValue(new Error('gateway down'));
    const result = await embedManyTexts(['a']);
    expect(result).toBeNull();
  });

  it('returns [] for empty input without calling embedMany', async () => {
    const result = await embedManyTexts([]);
    expect(result).toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });
});
