'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  initialCount: number;
  operatorId: string;
}

export default function RealtimeCounter({ initialCount, operatorId }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('books-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'books', filter: `operator_id=eq.${operatorId}` },
        () => setCount((c) => c + 1)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [operatorId]);

  return (
    <div className="rounded-2xl border border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)] bg-blue-600 p-5 flex flex-col gap-1">
      <span className="text-sm text-blue-200 font-medium">Livros adicionados hoje (tempo real)</span>
      <span className="text-3xl font-bold text-white">{count.toLocaleString('pt-BR')}</span>
      <span className="text-xs text-blue-300">● ao vivo</span>
    </div>
  );
}
