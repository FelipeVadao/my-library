'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: { stars: string; count: number }[];
}

export default function RatingDistributionChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Distribuição de notas (livros lidos)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.6} />
          <XAxis dataKey="stars" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-paper-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--color-ink)' }}
            itemStyle={{ color: 'var(--color-brass-strong)' }}
          />
          <Bar dataKey="count" fill="var(--color-brass-strong)" radius={[4, 4, 0, 0]} name="Livros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
