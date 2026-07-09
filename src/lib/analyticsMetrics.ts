export interface AnalyticsDetailRpc {
  decadeCounts: { decade: number; count: number }[];
  languageCounts: { language: string; count: number }[];
  collectionGrowth: { date: string; count: number }[];
  readingEvolution: { date: string; count: number }[];
  totalPagesRead: number;
  avgPagesPerBook: number | null;
  topAuthors: { author: string; count: number }[];
}

const LANGUAGE_LABELS: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
};

export function formatDecadeCounts(raw: { decade: number; count: number }[]) {
  return raw.map(({ decade, count }) => ({ label: `${decade}s`, count }));
}

export function formatLanguageCounts(raw: { language: string; count: number }[]) {
  return raw.map(({ language, count }) => ({
    label: LANGUAGE_LABELS[language.toLowerCase()] ?? language,
    count,
  }));
}

export function formatMonthlySeries(raw: { date: string; count: number }[]) {
  return raw.map(({ date, count }) => {
    const [year, month] = date.split('-');
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', {
      month: 'short',
      year: '2-digit',
    });
    return { date: label, count };
  });
}
