'use client';

import { Sparkles } from 'lucide-react';
import EmptyState from './EmptyState';

interface Props {
  recommendations: string[];
}

export default function RecommendationsList({ recommendations }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Recomendações</h3>
      {recommendations.length === 0 ? (
        <EmptyState icon={Sparkles} message="Tudo em dia, nenhuma recomendação no momento." />
      ) : (
        <ul className="space-y-3">
          {recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-forest shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
