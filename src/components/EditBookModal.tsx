'use client';

import { useState } from 'react';
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
  coverUrl: string;
  copies: string;
  readingStatus: ReadingStatus;
  rating: number;
  finishedYear: string;
  loanedTo: string;
  loanedAt: string;
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
    coverUrl: book.cover_url ?? '',
    copies: String(book.copies),
    readingStatus: book.reading_status,
    rating: book.rating ?? 0,
    finishedYear,
    loanedTo: book.loaned_to ?? '',
    loanedAt: book.loaned_at ? book.loaned_at.slice(0, 10) : '',
  };
}

export default function EditBookModal({ book, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EditForm>(() => bookToForm(book));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const title = form.title.trim();
    if (!title) return;
    setSaving(true);
    setError('');

    const isLido = form.readingStatus === 'lido';
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
      cover_url: form.coverUrl.trim() || null,
      copies: Number(form.copies) || 1,
      reading_status: form.readingStatus,
      rating: isLido && form.rating > 0 ? form.rating : null,
      finished_at: finishedAt,
      loaned_to: loanedTo,
      loaned_at: loanedAt,
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
        className="bg-paper-card rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold text-ink">Editar livro</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          {form.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverUrl} alt="Capa do livro" className="h-32 rounded-lg mx-auto" />
          )}

          <div>
            <label className="block text-ink-muted text-xs mb-1">ISBN</label>
            <input
              type="text"
              value={form.isbn}
              onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label className="block text-ink-muted text-xs mb-1">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label className="block text-ink-muted text-xs mb-1">Autor</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted text-xs mb-1">Editora</label>
              <input
                type="text"
                value={form.publisher}
                onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
            <div>
              <label className="block text-ink-muted text-xs mb-1">Ano de publicação</label>
              <input
                type="number"
                value={form.publishedYear}
                onChange={(e) => setForm((f) => ({ ...f, publishedYear: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-muted text-xs mb-1">Gênero</label>
            <input
              type="text"
              value={form.genre}
              onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label className="block text-ink-muted text-xs mb-1">Sinopse</label>
            <textarea
              value={form.synopsis}
              onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
              rows={2}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div>
            <label className="block text-ink-muted text-xs mb-1">Capa (URL)</label>
            <input
              type="text"
              value={form.coverUrl}
              onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
              className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted text-xs mb-1">Cópias</label>
              <input
                type="number"
                min={1}
                value={form.copies}
                onChange={(e) => setForm((f) => ({ ...f, copies: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>
            <div>
              <label className="block text-ink-muted text-xs mb-1">Status de leitura</label>
              <select
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
                      className={`text-2xl leading-none ${n <= form.rating ? 'text-brass-strong' : 'text-border'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-ink-muted text-xs mb-1">Ano de leitura</label>
                <div className="flex gap-2 items-center">
                  <input
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
                <label className="block text-ink-muted text-xs mb-1">Emprestado para</label>
                <input
                  type="text"
                  value={form.loanedTo}
                  onChange={(e) => setForm((f) => ({ ...f, loanedTo: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
              <div>
                <label className="block text-ink-muted text-xs mb-1">Data do empréstimo</label>
                <input
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
            className="flex-1 py-3 rounded-md font-semibold text-sm bg-forest hover:bg-forest-hover disabled:opacity-40 text-ink-deep transition"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
