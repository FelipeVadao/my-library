'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: { genre: string; count: number }[];
}

const COLORS = ['#A88420', '#74A15E', '#C97A3D', '#2E9C8A', '#C15A9E', '#E46458'];

export default function GenreDonutChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Distribuição por gênero</h3>
      {data.length === 0 ? (
        <p className="text-ink-muted text-sm">Sem dados suficientes ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="genre" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#2C2318', border: '1px solid #5A492F', borderRadius: 8 }}
              labelStyle={{ color: '#F1E6D2' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#B9A98C' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
