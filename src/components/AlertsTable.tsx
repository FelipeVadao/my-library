'use client';

import { CheckCircle2 } from 'lucide-react';
import EmptyState from './EmptyState';

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
  alta: 'bg-oxblood/15 text-oxblood-bright border-oxblood/40',
  media: 'bg-brass/15 text-brass-strong border-brass/40',
  baixa: 'bg-ink-muted/15 text-ink-muted border-ink-muted/40',
};

export default function AlertsTable({ alerts, title = 'Alertas recentes', emptyMessage = 'Nenhum alerta no momento.' }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">{title}</h3>
      {alerts.length === 0 ? (
        <EmptyState icon={CheckCircle2} message={emptyMessage} />
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{a.title}</p>
                <p className="text-xs text-ink-muted">{a.reason}</p>
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
