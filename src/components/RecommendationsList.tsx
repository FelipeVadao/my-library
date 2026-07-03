'use client';

interface Props {
  recommendations: string[];
}

export default function RecommendationsList({ recommendations }: Props) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)] bg-surface-panel p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Recomendações</h3>
      {recommendations.length === 0 ? (
        <p className="text-slate-500 text-sm">Tudo em dia, nenhuma recomendação no momento.</p>
      ) : (
        <ul className="space-y-3">
          {recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
