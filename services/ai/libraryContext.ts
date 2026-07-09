import type { Book, ReadingStatus } from '@/lib/supabase/types';

export type BookContextRow = Pick<
  Book,
  'title' | 'author' | 'genre' | 'reading_status' | 'rating' | 'added_at' | 'finished_at' | 'page_count' | 'favorite'
>;

// Kept in sync with the columns buildLibraryContext actually reads — the
// caller passes this straight into buildBooksQuery's `options.select` so
// the fetched columns can never drift out of sync with this module.
export const BOOK_CONTEXT_COLUMNS = 'title,author,genre,reading_status,rating,added_at,finished_at,page_count,favorite';

// Matches the labels already used in src/app/(app)/books/page.tsx's
// STATUS_LABEL — not imported directly since that's a page-local const.
const STATUS_LABEL: Record<ReadingStatus, string> = {
  quero_ler: 'quero ler',
  lendo: 'lendo',
  lido: 'lido',
};

// Dates are stored as UTC-midnight timestamps for what are conceptually
// just calendar dates (e.g. scan/page.tsx writes finishedYear as Jan 1
// UTC) — formatting in the local timezone can roll the date back a day
// west of UTC, so this reads the UTC calendar fields directly instead.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatBookLine(book: BookContextRow, index: number): string {
  const segments = [`"${book.title}"`];
  if (book.author) segments.push(book.author);

  const details: string[] = [];
  if (book.genre) details.push(`gênero: ${book.genre}`);
  details.push(`status: ${STATUS_LABEL[book.reading_status]}`);
  if (book.rating) details.push(`nota: ${book.rating}/5`);
  if (book.page_count) details.push(`páginas: ${book.page_count}`);
  if (book.reading_status === 'lido' && book.finished_at) details.push(`lido em: ${formatDate(book.finished_at)}`);
  if (book.favorite) details.push('favorito');

  return `${index + 1}. ${segments.join(' — ')} | ${details.join(' | ')}`;
}

export interface BuildLibraryContextOptions {
  /** True total row count for the user (from `count: 'exact'`), if known. */
  totalCount?: number;
}

export function buildLibraryContext(books: BookContextRow[], options: BuildLibraryContextOptions = {}): string {
  if (books.length === 0) {
    return 'O usuário ainda não tem nenhum livro cadastrado na biblioteca.';
  }

  const truncated = options.totalCount !== undefined && options.totalCount > books.length;
  const lines: string[] = [];

  if (truncated) {
    lines.push(
      `AVISO: esta lista está incompleta — mostra apenas ${books.length} dos ${options.totalCount} livros do ` +
        'usuário (os mais recentes). Se a pergunta depender do total exato ou de itens possivelmente fora desta ' +
        'lista, deixe claro na resposta que ela pode estar incompleta.'
    );
    lines.push('');
  }

  lines.push(
    truncated
      ? `Biblioteca do usuário (mostrando ${books.length} de ${options.totalCount} livros):`
      : `Biblioteca do usuário (${books.length} livros):`
  );
  books.forEach((book, i) => lines.push(formatBookLine(book, i)));

  return lines.join('\n');
}
