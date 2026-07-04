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
          <CartesianGrid strokeDasharray="3 3" stroke="#5A492F" strokeOpacity={0.6} />
          <XAxis dataKey="stars" tick={{ fill: '#B9A98C', fontSize: 11 }} />
          <YAxis tick={{ fill: '#B9A98C', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#2C2318', border: '1px solid #5A492F', borderRadius: 8 }}
            labelStyle={{ color: '#F1E6D2' }}
            itemStyle={{ color: '#C9A227' }}
          />
          <Bar dataKey="count" fill="#C9A227" radius={[4, 4, 0, 0]} name="Livros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
