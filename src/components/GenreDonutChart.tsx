'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: { genre: string; count: number }[];
}

const COLORS = ['#3b82f6', '#34d399', '#f59e0b', '#f43f5e', '#a78bfa', '#22d3ee'];

export default function GenreDonutChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-rose-500/40 shadow-[0_0_24px_rgba(244,63,94,0.15)] bg-surface-panel p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Distribuição por gênero</h3>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm">Sem dados suficientes ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="genre" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#f1f5f9' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
