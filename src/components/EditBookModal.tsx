'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import type { Book, ReadingStatus } from '@/lib/supabase/types';
import { updateBook } from '@/app/actions';

interface Props {
  book: Book;
  onClose: () => void;
  onSaved: () => void;
}

type EditForm = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  genre: string;
  synopsis: string;
  readerSummary: string;
  coverUrl: string;
  copies: string;
  readingStatus: ReadingStatus;
  rating: number;
  finishedYear: string;
  loanedTo: string;
  loanedAt: string;
  favorite: boolean;
  startedAt: string;
  pageCount: string;
  currentPage: string;
  language: string;
};

function bookToForm(book: Book): EditForm {
  const finishedYear = book.finished_at
    ? String(new Date(book.finished_at).getFullYear())
    : book.reading_status === 'lido'
      ? String(new Date().getFullYear())
      : '';
  return {
    isbn: book.isbn ?? '',
    title: book.title,
    author: book.author ?? '',
    publisher: book.publisher ?? '',
    publishedYear: book.published_year ? String(book.published_year) : '',
    genre: book.genre ?? '',
    synopsis: book.synopsis ?? '',
    readerSummary: book.reader_summary ?? '',
    coverUrl: book.cover_url ?? '',
    copies: String(book.copies),
    readingStatus: book.reading_status,
    rating: book.rating ?? 0,
    finishedYear,
    loanedTo: book.loaned_to ?? '',
    loanedAt: book.loaned_at ? book.loaned_at.slice(0, 10) : '',
    favorite: book.favorite,
    startedAt: book.started_at ? book.started_at.slice(0, 10) : '',
    pageCount: book.page_count ? String(book.page_count) : '',
    currentPage: book.current_page != null ? String(book.current_page) : '',
    language: book.language ?? '',
  };
}

export default function EditBookModal({ book, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EditForm>(() => bookToForm(book));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pageCountNum = Number(form.pageCount);
  const currentPageNum = Number(form.currentPage);
  const progressPercent =
    form.readingStatus === 'lendo' && pageCountNum > 0 && form.currentPage !== ''
      ? Math.min(100, Math.round((currentPageNum / pageCountNum) * 100))
      : null;

  async function handleSubmit() {
    const title = form.title.trim();
    if (!title) return;
    setSaving(true);
    setError('');

    const isLido = form.readingStatus === 'lido';
    const hasStarted = form.readingStatus !== 'quero_ler';
    const finishedAt = isLido && form.finishedYear
      ? new Date(Number(form.finishedYear), 0, 1).toISOString()
      : null;
    const loanedTo = form.loanedTo.trim() || null;
    const loanedAt = loanedTo
      ? (form.loanedAt ? new Date(form.loanedAt).toISOString() : new Date().toISOString())
      : null;

    const { error } = await updateBook(book.id, {
      title,
      isbn: form.isbn.trim() || null,
      author: form.author.trim() || null,
      publisher: form.publisher.trim() || null,
      published_year: form.publishedYear ? Number(form.publishedYear) : null,
      genre: form.genre.trim() || null,
      synopsis: form.synopsis.trim() || null,
      reader_summary: form.readerSummary.trim() || null,
      cover_url: form.coverUrl.trim() || null,
      copies: Number(form.copies) || 1,
      reading_status: form.readingStatus,
      rating: isLido && form.rating > 0 ? form.rating : null,
      finished_at: finishedAt,
      loaned_to: loanedTo,
      loaned_at: loanedAt,
      favorite: form.favorite,
      started_at: hasStarted && form.startedAt ? new Date(form.startedAt).toISOString() : null,
      page_count: form.pageCount ? Number(form.pageCount) : null,
      current_page: hasStarted && form.currentPage ? Number(form.currentPage) : null,
      language: form.language.trim() || null,
    });

    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-book-modal-title"
        className="bg-paper-card rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="edit-book-modal-title" className="font-serif text-lg font-bold text-ink">Editar livro</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, favorite: !f.favorite }))}
              aria-label={form.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
              title={form.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
              className={form.favorite ? 'text-brass-strong' : 'text-border'}
            >
              <Star size={22} fill={form.favorite ? 'currentColor' : 'none'} />
            </button>
            <button onClick={onClose} aria-label="Fechar" className="text-ink-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {form.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.coverUrl}
              alt={form.title ? `Capa de ${form.title}` : 'Capa do livro'}
              className="h-32 rounded-lg mx-auto"
            />
          )}

          <div>
            <label htmlFor="edit-isbn" className="block text-ink-muted text-xs mb-1">ISBN</label>
            <input
              id="edit-isbn"
              type="text"
              value={form.isbn}
              onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label htmlFor="edit-title" className="block text-ink-muted text-xs mb-1">Título</label>
            <input
              id="edit-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label htmlFor="edit-author" className="block text-ink-muted text-xs mb-1">Autor</label>
            <input
              id="edit-author"
              type="text"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-publisher" className="block text-ink-muted text-xs mb-1">Editora</label>
              <input
                id="edit-publisher"
                type="text"
                value={form.publisher}
                onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
            <div>
              <label htmlFor="edit-published-year" className="block text-ink-muted text-xs mb-1">Ano de publicação</label>
              <input
                id="edit-published-year"
                type="number"
                value={form.publishedYear}
                onChange={(e) => setForm((f) => ({ ...f, publishedYear: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-genre" className="block text-ink-muted text-xs mb-1">Gênero</label>
            <input
              id="edit-genre"
              type="text"
              value={form.genre}
              onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-page-count" className="block text-ink-muted text-xs mb-1">Páginas totais</label>
              <input
                id="edit-page-count"
                type="number"
                min={1}
                value={form.pageCount}
                onChange={(e) => setForm((f) => ({ ...f, pageCount: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
            <div>
              <label htmlFor="edit-language" className="block text-ink-muted text-xs mb-1">Idioma</label>
              <input
                id="edit-language"
                type="text"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-synopsis" className="block text-ink-muted text-xs mb-1">Sinopse</label>
            <textarea
              id="edit-synopsis"
              value={form.synopsis}
              onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
              rows={2}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label htmlFor="edit-reader-summary" className="block text-ink-muted text-xs mb-1">Resumo do leitor</label>
            <textarea
              id="edit-reader-summary"
              value={form.readerSummary}
              onChange={(e) => setForm((f) => ({ ...f, readerSummary: e.target.value }))}
              rows={4}
              maxLength={2000}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
            <p className="text-ink-muted text-xs mt-1 text-right">{form.readerSummary.length}/2000</p>
          </div>

          <div>
            <label htmlFor="edit-cover-url" className="block text-ink-muted text-xs mb-1">Capa (URL)</label>
            <input
              id="edit-cover-url"
              type="text"
              value={form.coverUrl}
              onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-copies" className="block text-ink-muted text-xs mb-1">Cópias</label>
              <input
                id="edit-copies"
                type="number"
                min={1}
                value={form.copies}
                onChange={(e) => setForm((f) => ({ ...f, copies: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
            <div>
              <label htmlFor="edit-reading-status" className="block text-ink-muted text-xs mb-1">Status de leitura</label>
              <select
                id="edit-reading-status"
                value={form.readingStatus}
                onChange={(e) => {
                  const next = e.target.value as ReadingStatus;
                  setForm((f) => ({
                    ...f,
                    readingStatus: next,
                    finishedYear: next === 'lido' && !f.finishedYear ? String(new Date().getFullYear()) : f.finishedYear,
                  }));
                }}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              >
                <option value="quero_ler">Quero ler</option>
                <option value="lendo">Lendo</option>
                <option value="lido">Lido</option>
              </select>
            </div>
          </div>

          {form.readingStatus !== 'quero_ler' && (
            <div>
              <label htmlFor="edit-started-at" className="block text-ink-muted text-xs mb-1">Data de início</label>
              <input
                id="edit-started-at"
                type="date"
                value={form.startedAt}
                onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
          )}

          {form.readingStatus === 'lendo' && (
            <div>
              <label htmlFor="edit-current-page" className="block text-ink-muted text-xs mb-1">
                Página atual{form.pageCount && ` (de ${form.pageCount})`}
              </label>
              <input
                id="edit-current-page"
                type="number"
                min={0}
                value={form.currentPage}
                onChange={(e) => setForm((f) => ({ ...f, currentPage: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
              {progressPercent !== null && (
                <div className="mt-2">
                  <div className="h-2 bg-tan rounded-full overflow-hidden">
                    <div className="h-full bg-brass-strong" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1">{progressPercent}% concluído</p>
                </div>
              )}
            </div>
          )}

          {form.readingStatus === 'lido' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted text-xs mb-1">Nota</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, rating: n === f.rating ? 0 : n }))}
                      aria-label={`Avaliar com ${n} estrela(s)`}
                      className={n <= form.rating ? 'text-brass-strong' : 'text-border'}
                    >
                      <Star size={22} fill={n <= form.rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="edit-finished-year" className="block text-ink-muted text-xs mb-1">Ano de leitura</label>
                <div className="flex gap-2 items-center">
                  <input
                    id="edit-finished-year"
                    type="number"
                    value={form.finishedYear}
                    onChange={(e) => setForm((f) => ({ ...f, finishedYear: e.target.value }))}
                    className="flex-1 bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                  />
                  {form.finishedYear && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, finishedYear: '' }))}
                      className="shrink-0 text-xs text-ink-muted hover:text-ink bg-tan hover:bg-border px-2 py-2 rounded-md transition"
                    >
                      Não sei
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <p className="text-ink-muted text-xs mb-2">Empréstimo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-loaned-to" className="block text-ink-muted text-xs mb-1">Emprestado para</label>
                <input
                  id="edit-loaned-to"
                  type="text"
                  value={form.loanedTo}
                  onChange={(e) => setForm((f) => ({ ...f, loanedTo: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
              <div>
                <label htmlFor="edit-loaned-at" className="block text-ink-muted text-xs mb-1">Data do empréstimo</label>
                <input
                  id="edit-loaned-at"
                  type="date"
                  value={form.loanedAt}
                  onChange={(e) => setForm((f) => ({ ...f, loanedAt: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-oxblood-bright text-sm mt-3">{error}</p>}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border text-ink transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim()}
            className="flex-1 py-3 rounded-md font-semibold text-sm bg-forest hover:bg-forest-hover disabled:opacity-40 text-on-accent transition"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2 justify-center"><Loader2 size={14} className="animate-spin" />Salvando...</span>
            ) : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
