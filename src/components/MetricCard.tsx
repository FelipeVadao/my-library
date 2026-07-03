'use client';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  glow?: 'emerald' | 'blue' | 'amber' | 'rose';
}

const GLOW_CLASSES: Record<NonNullable<Props['glow']>, string> = {
  emerald: 'border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)]',
  blue: 'border-blue-500/40 shadow-[0_0_24px_rgba(59,130,246,0.15)]',
  amber: 'border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.15)]',
  rose: 'border-rose-500/40 shadow-[0_0_24px_rgba(244,63,94,0.15)]',
};

export default function MetricCard({ label, value, sub, accent, glow }: Props) {
  const glowClass = glow ? GLOW_CLASSES[glow] : 'border-slate-800';
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-1 ${glowClass} ${
        accent ? 'bg-blue-600' : 'bg-surface-panel'
      }`}
    >
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}
