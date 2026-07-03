'use client';

interface Alert {
  title: string;
  reason: string;
  severity: 'alta' | 'media' | 'baixa';
}

interface Props {
  alerts: Alert[];
  title?: string;
  emptyMessage?: string;
}

const SEVERITY_CLASSES: Record<Alert['severity'], string> = {
  alta: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  media: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  baixa: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

export default function AlertsTable({ alerts, title = 'Alertas recentes', emptyMessage = 'Nenhum alerta no momento.' }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-surface-panel p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">{title}</h3>
      {alerts.length === 0 ? (
        <p className="text-slate-500 text-sm">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate">{a.title}</p>
                <p className="text-xs text-slate-500">{a.reason}</p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-1 rounded-full border ${SEVERITY_CLASSES[a.severity]}`}
              >
                {a.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
