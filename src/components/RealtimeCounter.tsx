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
    <div className="lamp-glow rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-brass-strong p-5 flex flex-col gap-1">
      <span className="text-sm text-ink-deep/80 font-medium">Livros adicionados hoje (tempo real)</span>
      <span className="font-serif text-3xl font-bold text-ink-deep">{count.toLocaleString('pt-BR')}</span>
      <span className="text-xs text-ink-deep/80">● ao vivo</span>
    </div>
  );
}
