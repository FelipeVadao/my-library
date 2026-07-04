'use client';

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface Props {
  value: number;
  max: number;
  label: string;
  sub?: string;
}

export default function ScoreGauge({ value, max, label, sub }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const data = [{ name: label, pct, fill: pct >= 70 ? '#74A15E' : pct >= 40 ? '#C9A227' : '#E4645A' }];

  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5 flex flex-col items-center">
      <span className="text-sm text-ink-muted font-medium self-start mb-2">{label}</span>
      <div className="relative w-full" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="pct" cornerRadius={12} background={{ fill: '#5A492F' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-serif text-3xl font-bold text-ink">{value}</span>
          <span className="text-xs text-ink-muted">de {max}</span>
        </div>
      </div>
      {sub && <span className="text-xs text-ink-muted mt-2">{sub}</span>}
    </div>
  );
}
