import { Users } from 'lucide-react';
import EmptyState from './EmptyState';

interface Props {
  authors: { author: string; count: number }[];
}

export default function TopAuthorsList({ authors }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Top autores</h3>
      {authors.length === 0 ? (
        <EmptyState icon={Users} message="Nenhum livro registrado ainda." />
      ) : (
        <div className="space-y-2">
          {authors.map((a, i) => (
            <div
              key={a.author}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-ink-muted text-sm w-5">{i + 1}</span>
                <span className="text-sm text-ink">{a.author}</span>
              </div>
              <span className="text-sm font-semibold text-brass-strong">
                {a.count.toLocaleString('pt-BR')} livro(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
