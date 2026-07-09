import { Star } from 'lucide-react';
import type { Book } from '@/lib/supabase/types';
import EmptyState from './EmptyState';

interface Props {
  books: Book[];
}

export default function FavoritesShelf({ books }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Favoritos</h3>
      {books.length === 0 ? (
        <EmptyState icon={Star} message="Nenhum favorito ainda — marque um livro como favorito ao editá-lo." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {books.map((b) => (
            <div key={b.id} className="shrink-0 w-24">
              {b.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.cover_url} alt={b.title} className="w-24 h-36 object-cover rounded-md" />
              ) : (
                <div className="w-24 h-36 rounded-md bg-tan" />
              )}
              <p className="text-xs text-ink mt-2 truncate">{b.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
