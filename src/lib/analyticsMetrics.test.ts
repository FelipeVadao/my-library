import { describe, it, expect } from 'vitest';
import { formatDecadeCounts, formatLanguageCounts, formatMonthlySeries } from './analyticsMetrics';

describe('formatDecadeCounts', () => {
  it('appends "s" to the raw decade number', () => {
    expect(formatDecadeCounts([
      { decade: 1990, count: 5 },
      { decade: 2000, count: 3 },
    ])).toEqual([
      { label: '1990s', count: 5 },
      { label: '2000s', count: 3 },
    ]);
  });
});

describe('formatLanguageCounts', () => {
  it('maps known ISO codes to pt-BR labels', () => {
    expect(formatLanguageCounts([
      { language: 'pt', count: 5 },
      { language: 'en', count: 3 },
    ])).toEqual([
      { label: 'Português', count: 5 },
      { label: 'Inglês', count: 3 },
    ]);
  });

  it('falls back to the raw code for unmapped languages', () => {
    expect(formatLanguageCounts([{ language: 'ja', count: 1 }])).toEqual([
      { label: 'ja', count: 1 },
    ]);
  });

  it('matches known codes case-insensitively', () => {
    expect(formatLanguageCounts([{ language: 'PT', count: 2 }])).toEqual([
      { label: 'Português', count: 2 },
    ]);
  });
});

describe('formatMonthlySeries', () => {
  it('formats YYYY-MM into a short month/year pt-BR label', () => {
    const format = (y: number, m: number) =>
      new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

    expect(formatMonthlySeries([
      { date: '2024-01', count: 2 },
      { date: '2026-07', count: 5 },
    ])).toEqual([
      { date: format(2024, 1), count: 2 },
      { date: format(2026, 7), count: 5 },
    ]);
  });

  it('returns an empty array for no entries', () => {
    expect(formatMonthlySeries([])).toEqual([]);
  });
});
