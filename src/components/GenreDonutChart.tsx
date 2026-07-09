'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import EmptyState from './EmptyState';

interface Props {
  data: { genre: string; count: number }[];
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

export default function GenreDonutChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Distribuição por gênero</h3>
      {data.length === 0 ? (
        <EmptyState icon={PieChartIcon} message="Sem dados suficientes ainda." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="genre" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--color-paper-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--color-ink)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-ink-muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
