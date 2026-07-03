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
  const data = [{ name: label, pct, fill: pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#f43f5e' }];

  return (
    <div className="rounded-2xl border border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)] bg-surface-panel p-5 flex flex-col items-center">
      <span className="text-sm text-slate-400 font-medium self-start mb-2">{label}</span>
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
            <RadialBar dataKey="pct" cornerRadius={12} background={{ fill: '#1e293b' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-white">{pct}</span>
          <span className="text-xs text-slate-400">de 100</span>
        </div>
      </div>
      {sub && <span className="text-xs text-slate-400 mt-2">{sub}</span>}
    </div>
  );
}
