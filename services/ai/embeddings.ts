import { embed, embedMany } from 'ai';
import { EMBEDDING_MODEL } from './config';

export interface EmbeddingSourceBook {
  title: string;
  author: string | null;
  genre: string | null;
  synopsis: string | null;
}

// Richest available semantic signal — deliberately NOT the same narrow
// column set BOOK_CONTEXT_COLUMNS uses for the text context (that one
// excludes synopsis to keep prompt tokens down; synopsis is exactly what
// makes semantic search useful for "livros sobre guerra"-style queries).
export function bookToEmbeddingText(book: EmbeddingSourceBook): string {
  return [book.title, book.author, book.genre, book.synopsis]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(' — ');
}

// Never-throw, matching booksApi.ts's fetchWithTimeout / isbnOcr.ts's
// recognizeIsbnFromImage — callers degrade gracefully on null rather than
// handling a rejection.
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const { embedding } = await embed({ model: EMBEDDING_MODEL, value: trimmed });
    return embedding;
  } catch {
    return null;
  }
}

// Order-preserving (matches embedMany's contract). Empty input returns []
// (nothing to do, not a failure) — only an actual failed call returns null.
export async function embedManyTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  try {
    const { embeddings } = await embedMany({ model: EMBEDDING_MODEL, values: texts });
    return embeddings;
  } catch {
    return null;
  }
}
