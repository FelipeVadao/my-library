'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: { date: string; count: number }[];
}

export default function DailyChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Livros adicionados (últimos 30 dias)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#5A492F" strokeOpacity={0.6} />
          <XAxis dataKey="date" tick={{ fill: '#B9A98C', fontSize: 11 }} />
          <YAxis tick={{ fill: '#B9A98C', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#2C2318', border: '1px solid #5A492F', borderRadius: 8 }}
            labelStyle={{ color: '#F1E6D2' }}
            itemStyle={{ color: '#74A15E' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#74A15E"
            strokeWidth={2}
            dot={{ fill: '#74A15E', r: 3 }}
            name="Livros"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
