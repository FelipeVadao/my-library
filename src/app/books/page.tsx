'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Book, ReadingStatus } from '@/lib/supabase/types';
import { deleteBook, deleteAllBooks } from '@/app/actions';
import { toCSV } from '@/lib/csv';
import Link from 'next/link';

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<ReadingStatus, string> = {
  quero_ler: 'Quero ler',
  lendo: 'Lendo',
  lido: 'Lido',
};

const STATUS_CLASSES: Record<ReadingStatus, string> = {
  quero_ler: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  lendo: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  lido: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-surface text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Dashboard</Link>
            <h1 className="text-xl font-bold mt-1">Meus livros</h1>
            <p className="text-slate-400 text-sm">{total.toLocaleString('pt-BR')} registros</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Exportar CSV
            </button>
            {!confirmDeleteAll ? (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="bg-red-900 hover:bg-red-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Apagar tudo
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-red-400 text-sm">Confirmar?</span>
                <button
                  onClick={handleDeleteAll}
                  className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
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
          className="w-full bg-surface-panel border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 mb-4 focus:outline-none focus:border-blue-500"
        />

        <div className="bg-surface-panel rounded-xl overflow-hidden border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Capa</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Título</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Autor</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Cópias</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Nota</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Adicionado</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Carregando...</td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum livro encontrado.</td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.cover_url} alt="" className="w-8 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-12 rounded bg-slate-700" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{b.title}</td>
                    <td className="px-4 py-3 text-slate-400">{b.author ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-200">{b.copies}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full border ${STATUS_CLASSES[b.reading_status]}`}>
                        {STATUS_LABEL[b.reading_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-amber-400">{b.rating ? '★'.repeat(b.rating) : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(b.added_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteOne(b.id)}
                        disabled={deleting === b.id}
                        className="text-red-500 hover:text-red-400 disabled:opacity-40 text-xs font-medium transition"
                      >
                        {deleting === b.id ? '...' : 'Apagar'}
                      </button>
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
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm transition"
            >
              Anterior
            </button>
            <span className="text-slate-400 text-sm">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm transition"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
