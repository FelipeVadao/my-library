'use client';

import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from 'recharts';

interface Stage {
  name: string;
  value: number;
  fill: string;
}

interface Props {
  title: string;
  stages: Stage[];
  caption?: string;
}

export default function ScanFunnel({ title, stages, caption }: Props) {
  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <FunnelChart>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-paper-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--color-ink)' }}
          />
          <Funnel dataKey="value" data={stages} isAnimationActive>
            <LabelList position="right" dataKey="name" fill="var(--color-ink-muted)" fontSize={12} />
            <LabelList position="center" dataKey="value" fill="var(--color-on-accent)" fontSize={16} fontWeight={700} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      {caption && <p className="text-xs text-ink-muted mt-2">{caption}</p>}
    </div>
  );
}
