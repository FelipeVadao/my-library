'use client';

import { LayoutGrid } from 'lucide-react';
import EmptyState from './EmptyState';

interface Props {
  genres: string[];
  months: string[];
  matrix: number[][]; // [genreIndex][monthIndex] = quantidade de livros
}

export default function GenreMonthHeatmap({ genres, months, matrix }: Props) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
      <h3 className="text-sm font-medium text-ink-muted mb-4">Livros por gênero x mês</h3>
      {genres.length === 0 ? (
        <EmptyState icon={LayoutGrid} message="Sem dados suficientes ainda." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th className="text-left text-ink-muted font-medium pr-2">Gênero</th>
                {months.map((m) => (
                  <th key={m} className="text-ink-muted font-medium px-1">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {genres.map((g, i) => (
                <tr key={g}>
                  <td className="text-ink truncate max-w-[140px] pr-2">{g}</td>
                  {months.map((m, j) => {
                    const v = matrix[i]?.[j] ?? 0;
                    const opacity = v === 0 ? 0.06 : 0.15 + 0.85 * (v / max);
                    return (
                      <td key={m} className="p-0">
                        <div
                          className={`w-9 h-9 rounded-md flex items-center justify-center text-[10px] ${opacity > 0.6 ? 'text-on-accent' : 'text-ink'}`}
                          style={{ backgroundColor: `rgba(var(--brass-strong-rgb),${opacity})` }}
                        >
                          {v > 0 ? v : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
