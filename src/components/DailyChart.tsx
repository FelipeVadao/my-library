'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: { date: string; count: number }[];
  title?: string;
}

export default function DailyChart({ data, title = 'Livros adicionados (últimos 30 dias)' }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.6} />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-paper-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--color-ink)' }}
            itemStyle={{ color: 'var(--color-forest)' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-forest)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-forest)', r: 3 }}
            name="Livros"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
