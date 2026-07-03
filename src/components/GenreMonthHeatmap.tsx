'use client';

interface Props {
  genres: string[];
  months: string[];
  matrix: number[][]; // [genreIndex][monthIndex] = quantidade de livros
}

export default function GenreMonthHeatmap({ genres, months, matrix }: Props) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="rounded-2xl border border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.15)] bg-surface-panel p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-4">Livros por gênero x mês</h3>
      {genres.length === 0 ? (
        <p className="text-slate-500 text-sm">Sem dados suficientes ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pr-2">Gênero</th>
                {months.map((m) => (
                  <th key={m} className="text-slate-400 font-medium px-1">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {genres.map((g, i) => (
                <tr key={g}>
                  <td className="text-slate-300 truncate max-w-[140px] pr-2">{g}</td>
                  {months.map((m, j) => {
                    const v = matrix[i]?.[j] ?? 0;
                    const opacity = v === 0 ? 0.06 : 0.15 + 0.85 * (v / max);
                    return (
                      <td key={m} className="p-0">
                        <div
                          className="w-9 h-9 rounded-md flex items-center justify-center text-[10px] text-white"
                          style={{ backgroundColor: `rgba(245,158,11,${opacity})` }}
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
