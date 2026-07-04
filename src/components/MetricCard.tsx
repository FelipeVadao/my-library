'use client';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function MetricCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className={`rounded-lg border border-border p-5 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.35)] ${
        accent ? 'bg-brass-strong' : 'bg-paper-card'
      }`}
    >
      <span className={`text-sm font-medium ${accent ? 'text-on-accent/80' : 'text-ink-muted'}`}>{label}</span>
      <span className={`font-serif text-3xl font-bold ${accent ? 'text-on-accent' : 'text-ink'}`}>{value}</span>
      {sub && <span className={`text-xs ${accent ? 'text-on-accent/80' : 'text-ink-muted'}`}>{sub}</span>}
    </div>
  );
}
