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
    <div className="rounded-2xl border border-blue-500/40 shadow-[0_0_24px_rgba(59,130,246,0.15)] bg-surface-panel p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <FunnelChart>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Funnel dataKey="value" data={stages} isAnimationActive>
            <LabelList position="right" dataKey="name" fill="#e2e8f0" fontSize={12} />
            <LabelList position="center" dataKey="value" fill="#0a0e1a" fontSize={14} fontWeight={700} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      {caption && <p className="text-xs text-slate-500 mt-2">{caption}</p>}
    </div>
  );
}
