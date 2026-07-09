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

export interface LibraryStatsSummary {
  totalBooks: number;
  lidoCount: number;
  lendoCount: number;
  queroLerCount: number;
  readThisYear: number;
}

function formatStatsBlock(stats: LibraryStatsSummary): string {
  return [
    'Estatísticas exatas da biblioteca do usuário (sempre precisas, independentemente da lista de livros abaixo):',
    `- Total de livros: ${stats.totalBooks}`,
    `- Lidos: ${stats.lidoCount}`,
    `- Lendo: ${stats.lendoCount}`,
    `- Quero ler: ${stats.queroLerCount}`,
    `- Lidos este ano: ${stats.readThisYear}`,
  ].join('\n');
}

export interface BuildLibraryContextOptions {
  /** True total row count for the user (from `count: 'exact'`), if known. */
  totalCount?: number;
  /** Exact counts from get_dashboard_metrics — always accurate regardless
   *  of how `books` below was selected. */
  stats?: LibraryStatsSummary;
  /** How `books` was chosen relative to `totalCount`. Defaults to 'recent'
   *  for backward compatibility with the fetch-newest-N fallback path. */
  selectionMode?: 'recent' | 'relevant';
}

export function buildLibraryContext(books: BookContextRow[], options: BuildLibraryContextOptions = {}): string {
  const { stats, selectionMode = 'recent' } = options;

  if (books.length === 0) {
    if (stats && stats.totalBooks > 0) {
      return [
        formatStatsBlock(stats),
        '',
        'A lista detalhada de livros não pôde ser carregada para esta pergunta — use apenas as estatísticas ' +
          'exatas acima. Se a pergunta depender de detalhes de livros específicos (título, autor, gênero, ' +
          'sinopse), diga que essa informação não está disponível no momento.',
      ].join('\n');
    }
    return 'O usuário ainda não tem nenhum livro cadastrado na biblioteca.';
  }

  const truncated = options.totalCount !== undefined && options.totalCount > books.length;
  const lines: string[] = [];

  if (stats) {
    lines.push(formatStatsBlock(stats), '');
  }

  if (truncated) {
    lines.push(
      selectionMode === 'relevant'
        ? `AVISO: esta lista está incompleta — mostra apenas os ${books.length} livros mais RELEVANTES para a ` +
            `pergunta (busca semântica), de um total de ${options.totalCount} livros do usuário. Pode haver ` +
            'livros relevantes que não aparecem aqui. Para perguntas sobre contagem total, completude ou ' +
            '"todos os livros de X", prefira as estatísticas exatas acima a esta lista parcial, e deixe claro ' +
            'que a lista de livros específicos pode estar incompleta.'
        : `AVISO: esta lista está incompleta — mostra apenas ${books.length} dos ${options.totalCount} livros do ` +
            'usuário (os mais recentes). Se a pergunta depender do total exato ou de itens possivelmente fora ' +
            'desta lista, deixe claro na resposta que ela pode estar incompleta.'
    );
    lines.push('');
  }

  lines.push(
    truncated
      ? selectionMode === 'relevant'
        ? `Biblioteca do usuário — ${books.length} livros mais relevantes para a pergunta (de ${options.totalCount} no total):`
        : `Biblioteca do usuário (mostrando ${books.length} de ${options.totalCount} livros):`
      : `Biblioteca do usuário (${books.length} livros):`
  );
  books.forEach((book, i) => lines.push(formatBookLine(book, i)));

  return lines.join('\n');
}
