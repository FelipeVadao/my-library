import type { Book } from './supabase/types';

export interface DashboardMetricsRpc {
  todayCount: number;
  totalBooks: number;
  totalCopies: number;
  lidoCount: number;
  lendoCount: number;
  queroLerCount: number;
  readThisYear: number;
  unratedReadCount: number;
  dailyData: { date: string; count: number }[];
  genreMonthHeatmap: { genres: string[]; months: string[]; matrix: number[][] };
  ratingDistribution: { star: number; count: number }[];
  genreDonut: { genre: string; count: number }[];
  topAuthors: { author: string; count: number }[];
  topLidoGenre: { genre: string; count: number } | null;
}

export function formatDailyData(raw: { date: string; count: number }[]) {
  return raw.map(({ date, count }) => ({
    date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    count,
  }));
}

export function formatGenreMonthHeatmap(raw: { genres: string[]; months: string[]; matrix: number[][] }) {
  return {
    genres: raw.genres,
    months: raw.months.map((m) => {
      const [year, month] = m.split('-');
      return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
    }),
    matrix: raw.matrix,
  };
}

export function formatRatingDistribution(raw: { star: number; count: number }[]) {
  return raw.map(({ star, count }) => ({ label: `${star}★`, count }));
}

export function buildAlerts(books: Book[]) {
  const now = Date.now();
  return books
    .filter((b) => b.reading_status === 'lendo')
    .map((b) => {
      const daysSinceUpdate = Math.floor((now - new Date(b.updated_at).getTime()) / 86400000);
      return { book: b, daysSinceUpdate };
    })
    .filter((x) => x.daysSinceUpdate >= 30)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 8)
    .map(({ book, daysSinceUpdate }) => ({
      title: book.title,
      reason: `Sem atualização há ${daysSinceUpdate} dias — ainda em "lendo".`,
      severity: (daysSinceUpdate >= 60 ? 'alta' : 'media') as 'alta' | 'media',
    }));
}

export function buildLoanedBooks(books: Book[]) {
  const now = Date.now();
  return books
    .filter((b) => b.loaned_to)
    .map((b) => {
      const days = b.loaned_at
        ? Math.floor((now - new Date(b.loaned_at).getTime()) / 86400000)
        : 0;
      return { book: b, days };
    })
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)
    .map(({ book, days }) => ({
      title: book.title,
      reason: `Emprestado para ${book.loaned_to} há ${days} dia(s).`,
      severity: (days >= 60 ? 'alta' : 'media') as 'alta' | 'media',
    }));
}

export interface RecommendationInputs {
  queroLerCount: number;
  topLidoGenre: { genre: string; count: number } | null;
  unratedReadCount: number;
  dailyData: { date: string; count: number }[];
}

export function buildRecommendations(input: RecommendationInputs): string[] {
  const recs: string[] = [];

  if (input.queroLerCount >= 5) {
    recs.push(`Você tem ${input.queroLerCount} livros na fila "quero ler" — que tal escolher o próximo?`);
  }

  if (input.topLidoGenre) {
    recs.push(`Seu gênero favorito é ${input.topLidoGenre.genre} (${input.topLidoGenre.count} livro(s) lido(s)).`);
  }

  if (input.unratedReadCount > 0) {
    recs.push(`${input.unratedReadCount} livro(s) lido(s) sem avaliação — vale registrar sua nota.`);
  }

  const addedRecently = input.dailyData.reduce((sum, d) => sum + d.count, 0);
  if (addedRecently === 0) {
    recs.push('Nenhum livro adicionado nos últimos 30 dias.');
  }

  return recs;
}
