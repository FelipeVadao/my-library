'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import { updateReadingGoal } from '@/app/actions';

interface Props {
  value: number;
  initialGoal: number;
}

export default function ReadingGoalGauge({ value, initialGoal }: Props) {
  const [goal, setGoal] = useState(initialGoal);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(initialGoal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const parsed = Math.trunc(Number(input));
    if (!parsed || parsed < 1) {
      setError('Informe um número válido.');
      return;
    }
    setSaving(true);
    setError('');
    const { error } = await updateReadingGoal(parsed);
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    setGoal(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5 flex flex-col gap-3">
        <span className="text-sm text-ink-muted font-medium">Meta de leitura anual</span>
        <input
          type="number"
          min={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
        />
        {error && <p className="text-oxblood-bright text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(false); setInput(String(goal)); setError(''); }}
            className="flex-1 py-2 rounded-md text-sm font-semibold bg-tan hover:bg-border text-ink transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-semibold bg-forest hover:bg-forest-hover disabled:opacity-40 text-on-accent transition"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2 justify-center"><Loader2 size={14} className="animate-spin" />Salvando...</span>
            ) : 'Salvar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <ScoreGauge
        value={value}
        max={goal}
        label="Meta de leitura anual"
        sub={`${value} de ${goal} livros lidos`}
      />
      <button
        onClick={() => setEditing(true)}
        className="absolute top-4 right-4 text-xs text-ink-muted hover:text-ink"
      >
        Editar
      </button>
    </div>
  );
}
