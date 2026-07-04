'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Book, ReadingStatus } from '@/lib/supabase/types';
import { deleteBook, deleteAllBooks, markBookLoaned, clearLoan } from '@/app/actions';
import { toCSV } from '@/lib/csv';
import Link from 'next/link';
import EditBookModal from '@/components/EditBookModal';

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
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [loaningId, setLoaningId] = useState<string | null>(null);
  const [loanName, setLoanName] = useState('');
  const [loanBusy, setLoanBusy] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .order('added_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search.trim()) {
      const term = search.trim();
      query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%`);
    }

    const { data, count } = await query;
    setBooks((data as Book[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, supabase]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  useEffect(() => { setPage(0); }, [search]);

  async function handleExport() {
    let query = supabase.from('books').select('*').order('added_at', { ascending: false });
    if (search.trim()) {
      const term = search.trim();
      query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%`);
    }
    const { data } = await query;
    if (data) downloadCSV(data as Book[]);
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
            <Link href="/" className="text-brass-strong hover:text-brass-strong-hover text-sm">← Dashboard</Link>
            <h1 className="font-serif text-xl font-bold mt-1">Meus livros</h1>
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

        <input
          type="text"
          placeholder="Buscar por título ou autor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-paper-card border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted mb-4 focus:outline-none focus:border-brass-strong"
        />

        <p className="md:hidden text-xs text-ink-muted mb-2">
          ← Arraste a tabela para o lado para ver status, empréstimo e ações →
        </p>

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
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-ink-muted">Carregando...</td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-ink-muted">Nenhum livro encontrado.</td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 hover:bg-tan/50">
                    <td className="px-4 py-3">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.cover_url} alt="" className="w-8 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-12 rounded bg-tan" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{b.title}</td>
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
                    <td className="px-4 py-3 text-brass-strong">{b.rating ? '★'.repeat(b.rating) : '—'}</td>
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
                            className="w-40 bg-paper border border-border rounded-md px-2 py-1 text-ink text-xs placeholder-ink-muted focus:outline-none focus:border-brass-strong"
                          />
                          <button
                            onClick={() => handleConfirmLoan(b.id)}
                            disabled={loanBusy === b.id || !loanName.trim()}
                            className="bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-40 text-on-accent text-xs font-medium px-3 py-1.5 rounded-md transition"
                          >
                            {loanBusy === b.id ? '...' : 'Confirmar'}
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
                            onClick={() => setEditingBook(b)}
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
                              {loanBusy === b.id ? '...' : 'Devolver'}
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
                            {deleting === b.id ? '...' : 'Apagar'}
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
          onClose={() => setEditingBook(null)}
          onSaved={fetchBooks}
        />
      )}
    </main>
  );
}
