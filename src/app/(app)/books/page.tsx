'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Star, Loader2, SearchX, List, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Book, ReadingStatus } from '@/lib/supabase/types';
import { deleteBook, deleteAllBooks, markBookLoaned, clearLoan } from '@/app/actions';
import { toCSV } from '@/lib/csv';
import { buildBooksQuery, type BookFilter } from '@/lib/bookQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import EditBookModal from '@/components/EditBookModal';
import EmptyState from '@/components/EmptyState';

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<ReadingStatus, string> = {
  quero_ler: 'Quero ler',
  lendo: 'Lendo',
  lido: 'Lido',
};

const STATUS_CLASSES: Record<ReadingStatus, string> = {
  quero_ler: 'bg-ink-muted/15 text-ink-muted border-ink-muted/40',
  lendo: 'bg-brass/15 text-brass-strong border-brass/40',
  lido: 'bg-forest/15 text-forest border-forest/40',
};

const STATUS_OPTIONS: ReadingStatus[] = ['quero_ler', 'lendo', 'lido'];

interface GenreFacet {
  genre: string;
  book_count: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function downloadCSV(books: Book[]) {
  const blob = new Blob([toCSV(books)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `livros-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BooksPage() {
  const [supabase] = useState(() => createClient());
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [loaningId, setLoaningId] = useState<string | null>(null);
  const [loanName, setLoanName] = useState('');
  const [loanBusy, setLoanBusy] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const [view, setView] = useState<'table' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'table';
    try {
      return localStorage.getItem('books-view') === 'grid' ? 'grid' : 'table';
    } catch {
      return 'table';
    }
  });

  function handleSetView(v: 'table' | 'grid') {
    setView(v);
    try {
      localStorage.setItem('books-view', v);
    } catch {
      // localStorage indisponível (modo privado etc.) — visão muda na sessão, mas não persiste
    }
  }

  const [searchInput, setSearchInput] = useState('');
  const debouncedText = useDebouncedValue(searchInput, 300);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [minPages, setMinPages] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [genreFacets, setGenreFacets] = useState<GenreFacet[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setOperatorId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!operatorId) return;
    supabase.rpc('get_genre_facets', { p_operator_id: operatorId }).then(({ data }) => {
      setGenreFacets((data as GenreFacet[]) ?? []);
    });
  }, [operatorId, supabase]);

  const hasActiveFilters =
    statusFilter.length > 0 ||
    favoriteOnly ||
    minRating > 0 ||
    minPages.trim() !== '' ||
    maxPages.trim() !== '' ||
    yearFrom.trim() !== '' ||
    yearTo.trim() !== '' ||
    genreFilter.length > 0;

  const activeFilterCount =
    (statusFilter.length > 0 ? 1 : 0) +
    (favoriteOnly ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (minPages.trim() || maxPages.trim() ? 1 : 0) +
    (yearFrom.trim() || yearTo.trim() ? 1 : 0) +
    (genreFilter.length > 0 ? 1 : 0);

  const filter: BookFilter = useMemo(() => {
    const f: BookFilter = {};
    if (debouncedText.trim()) f.text = debouncedText;
    if (statusFilter.length) f.readingStatus = statusFilter;
    if (favoriteOnly) f.favorite = true;
    if (minRating > 0) f.minRating = minRating;
    if (minPages.trim()) f.minPageCount = Number(minPages);
    if (maxPages.trim()) f.maxPageCount = Number(maxPages);
    if (yearFrom.trim()) f.publishedYearFrom = Number(yearFrom);
    if (yearTo.trim()) f.publishedYearTo = Number(yearTo);
    if (genreFilter.length) f.genre = genreFilter;
    return f;
  }, [debouncedText, statusFilter, favoriteOnly, minRating, minPages, maxPages, yearFrom, yearTo, genreFilter]);

  const fetchBooks = useCallback(async () => {
    if (!operatorId) return;
    setLoading(true);
    const { data, count } = await buildBooksQuery(
      supabase,
      operatorId,
      { ...filter, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      { select: '*', count: 'exact' }
    );
    setBooks((data as unknown as Book[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [operatorId, filter, page, supabase]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  useEffect(() => { setPage(0); }, [filter]);

  async function handleExport() {
    if (!operatorId) return;
    const { data } = await buildBooksQuery(supabase, operatorId, filter, { select: '*' });
    if (data) downloadCSV(data as unknown as Book[]);
  }

  function handleClearFilters() {
    setStatusFilter([]);
    setFavoriteOnly(false);
    setMinRating(0);
    setMinPages('');
    setMaxPages('');
    setYearFrom('');
    setYearTo('');
    setGenreFilter([]);
  }

  function toggleStatus(status: ReadingStatus) {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  }

  function toggleGenre(genre: string) {
    setGenreFilter((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  }

  async function handleDeleteOne(id: string) {
    setDeleting(id);
    await deleteBook(id);
    setDeleting(null);
    fetchBooks();
  }

  async function handleDeleteAll() {
    setConfirmDeleteAll(false);
    setLoading(true);
    await deleteAllBooks();
    fetchBooks();
  }

  async function handleConfirmLoan(id: string) {
    const name = loanName.trim();
    if (!name) return;
    setLoanBusy(id);
    await markBookLoaned(id, name);
    setLoanBusy(null);
    setLoaningId(null);
    setLoanName('');
    fetchBooks();
  }

  async function handleReturn(id: string) {
    setLoanBusy(id);
    await clearLoan(id);
    setLoanBusy(null);
    fetchBooks();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-paper text-ink p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-xl font-bold">Meus livros</h1>
            <p className="text-ink-muted text-sm">{total.toLocaleString('pt-BR')} registros</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="bg-tan hover:bg-border text-ink text-sm font-medium px-4 py-2 rounded-md transition"
            >
              Exportar CSV
            </button>
            {!confirmDeleteAll ? (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="bg-oxblood hover:bg-oxblood-hover text-ink text-sm font-medium px-4 py-2 rounded-md transition"
              >
                Apagar tudo
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-oxblood-bright text-sm">Confirmar?</span>
                <button
                  onClick={handleDeleteAll}
                  className="bg-oxblood hover:bg-oxblood-hover text-ink text-sm font-medium px-3 py-2 rounded-md transition"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="bg-tan hover:bg-border text-ink text-sm font-medium px-3 py-2 rounded-md transition"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Buscar por título, autor, gênero ou editora..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 bg-paper-card border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted focus:outline-none focus:border-brass-strong"
          />
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`shrink-0 px-4 py-3 rounded-md text-sm font-medium transition border ${
              filtersOpen || hasActiveFilters
                ? 'bg-brass-strong text-on-accent border-brass-strong'
                : 'bg-paper-card text-ink border-border hover:border-brass'
            }`}
          >
            Filtros{hasActiveFilters ? ` (${activeFilterCount})` : ''}
          </button>
          <div className="shrink-0 flex gap-1 bg-paper-card border border-border rounded-md p-1">
            <button
              type="button"
              onClick={() => handleSetView('table')}
              aria-label="Ver como tabela"
              aria-pressed={view === 'table'}
              className={`p-2 rounded transition ${view === 'table' ? 'bg-brass-strong text-on-accent' : 'text-ink-muted hover:text-ink'}`}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleSetView('grid')}
              aria-label="Ver como grade de capas"
              aria-pressed={view === 'grid'}
              className={`p-2 rounded transition ${view === 'grid' ? 'bg-brass-strong text-on-accent' : 'text-ink-muted hover:text-ink'}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="bg-paper-card border border-border rounded-lg p-4 mb-4 space-y-4">
            <div>
              <p className="text-ink-muted text-xs mb-2">Status</p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((status) => {
                  const active = statusFilter.includes(status);
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`text-[10px] font-semibold uppercase px-3 py-1.5 rounded-md border transition ${
                        active ? STATUS_CLASSES[status] : 'bg-paper text-ink-muted border-border hover:border-brass'
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-ink-muted text-xs mb-2">Favorito</p>
                <button
                  type="button"
                  onClick={() => setFavoriteOnly((v) => !v)}
                  aria-label={favoriteOnly ? 'Mostrando só favoritos' : 'Mostrar só favoritos'}
                  className={favoriteOnly ? 'text-brass-strong' : 'text-border'}
                >
                  <Star size={20} fill={favoriteOnly ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div>
                <p className="text-ink-muted text-xs mb-2">Nota mínima</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMinRating((prev) => (prev === n ? 0 : n))}
                      aria-label={`Nota mínima: ${n} estrela(s)`}
                      className={n <= minRating ? 'text-brass-strong' : 'text-border'}
                    >
                      <Star size={20} fill={n <= minRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="filter-min-pages" className="block text-ink-muted text-xs mb-2">Páginas</label>
                <div className="flex gap-2">
                  <input
                    id="filter-min-pages"
                    type="number"
                    min={1}
                    placeholder="Mín"
                    aria-label="Páginas, mínimo"
                    value={minPages}
                    onChange={(e) => setMinPages(e.target.value)}
                    className="w-full bg-paper border border-border rounded-md px-2 py-1.5 text-ink text-sm focus:outline-none focus:border-brass-strong"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Máx"
                    aria-label="Páginas, máximo"
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    className="w-full bg-paper border border-border rounded-md px-2 py-1.5 text-ink text-sm focus:outline-none focus:border-brass-strong"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="filter-year-from" className="block text-ink-muted text-xs mb-2">Ano de publicação</label>
                <div className="flex gap-2">
                  <input
                    id="filter-year-from"
                    type="number"
                    placeholder="De"
                    aria-label="Ano de publicação, de"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="w-full bg-paper border border-border rounded-md px-2 py-1.5 text-ink text-sm focus:outline-none focus:border-brass-strong"
                  />
                  <input
                    type="number"
                    placeholder="Até"
                    aria-label="Ano de publicação, até"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="w-full bg-paper border border-border rounded-md px-2 py-1.5 text-ink text-sm focus:outline-none focus:border-brass-strong"
                  />
                </div>
              </div>
            </div>

            {genreFacets.length > 0 && (
              <div>
                <p className="text-ink-muted text-xs mb-2">Gênero</p>
                <div className="flex gap-2 flex-wrap">
                  {genreFacets.map(({ genre, book_count }) => {
                    const active = genreFilter.includes(genre);
                    return (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                          active
                            ? 'bg-brass-strong text-on-accent border-brass-strong'
                            : 'bg-paper text-ink-muted border-border hover:border-brass'
                        }`}
                      >
                        {genre} ({book_count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasActiveFilters && (
              <button onClick={handleClearFilters} className="text-xs text-oxblood-bright hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {view === 'table' && (
          <p className="md:hidden text-xs text-ink-muted mb-2">
            ← Arraste a tabela para o lado para ver status, empréstimo e ações →
          </p>
        )}

        {view === 'table' ? (
        <div className="bg-paper-card rounded-lg overflow-x-auto border border-border">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Capa</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Título</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Autor</th>
                <th className="text-right px-4 py-3 text-ink-muted font-medium">Cópias</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Emprestado</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Nota</th>
                <th className="text-left px-4 py-3 text-ink-muted font-medium">Adicionado</th>
                <th className="text-right px-4 py-3 text-ink-muted font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="px-4 py-3"><div className="w-8 h-12 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-6 rounded bg-tan animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 rounded-md bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-tan animate-pulse" /></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                ))
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState icon={SearchX} message="Nenhum livro encontrado." />
                  </td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 hover:bg-tan/50">
                    <td className="px-4 py-3">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.cover_url} alt={b.title} className="w-8 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-12 rounded bg-tan" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        {b.favorite && (
                          <Star size={14} fill="currentColor" aria-label="Favorito" className="text-brass-strong shrink-0" />
                        )}
                        {b.title}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{b.author ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-ink">{b.copies}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-md border ${STATUS_CLASSES[b.reading_status]}`}>
                        {STATUS_LABEL[b.reading_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.loaned_to ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-md border bg-brass/15 text-brass-strong border-brass/40 w-fit">
                            Emprestado
                          </span>
                          <span className="text-xs text-ink">{b.loaned_to}</span>
                        </div>
                      ) : (
                        <span className="text-ink-muted/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brass-strong">
                      {b.rating ? (
                        <span className="inline-flex gap-0.5" aria-label={`${b.rating} de 5 estrelas`}>
                          {[1, 2, 3, 4, 5].slice(0, b.rating).map((n) => (
                            <Star key={n} size={12} fill="currentColor" aria-hidden="true" />
                          ))}
                        </span>
                      ) : (
                        <span className="text-ink-muted/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{formatDate(b.added_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {loaningId === b.id ? (
                        <div className="flex gap-2 items-center justify-end">
                          <input
                            type="text"
                            autoFocus
                            value={loanName}
                            onChange={(e) => setLoanName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmLoan(b.id)}
                            placeholder="Nome de quem pegou"
                            aria-label="Nome de quem pegou o livro"
                            className="w-40 bg-paper border border-border rounded-md px-2 py-1 text-ink text-xs placeholder-ink-muted focus:outline-none focus:border-brass-strong"
                          />
                          <button
                            onClick={() => handleConfirmLoan(b.id)}
                            disabled={loanBusy === b.id || !loanName.trim()}
                            className="bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-40 text-on-accent text-xs font-medium px-3 py-1.5 rounded-md transition"
                          >
                            {loanBusy === b.id ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                          </button>
                          <button
                            onClick={() => { setLoaningId(null); setLoanName(''); }}
                            className="bg-tan hover:bg-border text-ink text-xs font-medium px-3 py-1.5 rounded-md transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center justify-end">
                          <button
                            onClick={(e) => { lastTriggerRef.current = e.currentTarget; setEditingBook(b); }}
                            className="bg-tan hover:bg-border text-ink text-xs font-medium px-3 py-1.5 rounded-md transition"
                          >
                            Editar
                          </button>
                          {b.loaned_to ? (
                            <button
                              onClick={() => handleReturn(b.id)}
                              disabled={loanBusy === b.id}
                              className="bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-40 text-on-accent text-xs font-medium px-3 py-1.5 rounded-md transition"
                            >
                              {loanBusy === b.id ? <Loader2 size={14} className="animate-spin" /> : 'Devolver'}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setLoaningId(b.id); setLoanName(''); }}
                              className="bg-tan hover:bg-border text-ink text-xs font-medium px-3 py-1.5 rounded-md transition"
                            >
                              Emprestar
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOne(b.id)}
                            disabled={deleting === b.id}
                            className="bg-oxblood hover:bg-oxblood-hover disabled:opacity-40 text-ink text-xs font-medium px-3 py-1.5 rounded-md transition"
                          >
                            {deleting === b.id ? <Loader2 size={14} className="animate-spin" /> : 'Apagar'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-paper-card p-2">
                <div className="aspect-[2/3] rounded bg-tan animate-pulse mb-2" />
                <div className="h-3 w-4/5 rounded bg-tan animate-pulse mb-1" />
                <div className="h-3 w-3/5 rounded bg-tan animate-pulse" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState icon={SearchX} message="Nenhum livro encontrado." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={(e) => { lastTriggerRef.current = e.currentTarget; setEditingBook(b); }}
                className="text-left rounded-lg border border-border bg-paper-card p-2 hover:border-brass transition"
              >
                <div className="relative aspect-[2/3] rounded overflow-hidden bg-tan mb-2">
                  {b.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" />
                  )}
                  {b.favorite && (
                    <Star
                      size={14}
                      fill="currentColor"
                      aria-label="Favorito"
                      className="absolute top-1.5 right-1.5 text-brass-strong drop-shadow"
                    />
                  )}
                  <span
                    className={`absolute bottom-1.5 left-1.5 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${STATUS_CLASSES[b.reading_status]}`}
                  >
                    {STATUS_LABEL[b.reading_status]}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink line-clamp-2 leading-snug">{b.title}</p>
                <p className="text-[11px] text-ink-muted line-clamp-1">{b.author ?? '—'}</p>
                {b.rating ? (
                  <span className="inline-flex gap-0.5 mt-1 text-brass-strong" aria-label={`${b.rating} de 5 estrelas`}>
                    {[1, 2, 3, 4, 5].slice(0, b.rating).map((n) => (
                      <Star key={n} size={10} fill="currentColor" aria-hidden="true" />
                    ))}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-tan hover:bg-border text-ink disabled:opacity-40 rounded-md text-sm transition"
            >
              Anterior
            </button>
            <span className="text-ink-muted text-sm">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 bg-tan hover:bg-border text-ink disabled:opacity-40 rounded-md text-sm transition"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {editingBook && (
        <EditBookModal
          key={editingBook.id}
          book={editingBook}
          onClose={() => { setEditingBook(null); lastTriggerRef.current?.focus(); }}
          onSaved={fetchBooks}
        />
      )}
    </main>
  );
}
