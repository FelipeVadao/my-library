import { BookOpen } from 'lucide-react';
import type { Book } from '@/lib/supabase/types';
import EmptyState from './EmptyState';

interface Props {
  books: Book[];
}

export default function CurrentlyReadingList({ books }: Props) {
  const visible = books.slice(0, 6);

  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Continuando a leitura</h3>
      {visible.length === 0 ? (
        <EmptyState icon={BookOpen} message="Nenhum livro em leitura no momento." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((b) => {
            const progress =
              b.page_count && b.current_page != null
                ? Math.min(100, Math.round((b.current_page / b.page_count) * 100))
                : null;
            return (
              <div key={b.id} className="flex gap-3 p-3 rounded-md bg-paper border border-border">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url} alt={b.title} className="w-16 h-24 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-16 h-24 rounded bg-tan shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{b.title}</p>
                  <p className="text-xs text-ink-muted truncate">{b.author ?? '—'}</p>
                  {progress !== null ? (
                    <div className="mt-2">
                      <div className="h-1.5 bg-tan rounded-full overflow-hidden">
                        <div className="h-full bg-brass-strong" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-ink-muted mt-1">
                        {progress}% • pág. {b.current_page} de {b.page_count}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-ink-muted/70 mt-2">Progresso não registrado</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
