import type { Book } from './supabase/types';

export function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export function buildDailyData(books: Book[]) {
  const counts: Record<string, number> = {};
  for (const b of books) {
    const date = b.added_at.slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      count,
    }));
}

export function buildGenreMonthHeatmap(books: Book[]) {
  const totalsByGenre: Record<string, number> = {};
  for (const b of books) {
    const genre = b.genre?.trim();
    if (!genre) continue;
    totalsByGenre[genre] = (totalsByGenre[genre] ?? 0) + 1;
  }
  const genres = Object.entries(totalsByGenre)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name]) => name);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const matrix = genres.map((genre) =>
    months.map((month) =>
      books.filter((b) => b.genre?.trim() === genre && b.added_at.slice(0, 7) === month).length
    )
  );

  const monthLabels = months.map((m) => {
    const [year, month] = m.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
  });

  return { genres, months: monthLabels, matrix };
}

export function buildRatingDistribution(books: Book[]) {
  const readBooks = books.filter((b) => b.reading_status === 'lido');
  return [1, 2, 3, 4, 5].map((stars) => ({
    stars: `${stars}★`,
    count: readBooks.filter((b) => b.rating === stars).length,
  }));
}

export function buildGenreDonut(books: Book[]) {
  const totals: Record<string, number> = {};
  for (const b of books) {
    const genre = b.genre?.trim() || 'Sem gênero';
    totals[genre] = (totals[genre] ?? 0) + 1;
  }
  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((sum, [, count]) => sum + count, 0);
  const data = top.map(([genre, count]) => ({ genre, count }));
  if (rest > 0) data.push({ genre: 'Outros', count: rest });
  return data;
}

export function buildTopAuthors(books: Book[]) {
  const counts: Record<string, number> = {};
  for (const b of books) {
    const author = b.author?.trim();
    if (!author) continue;
    counts[author] = (counts[author] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([author, count]) => ({ author, count }));
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

export function buildRecommendations(books: Book[], dailyData: { count: number }[]) {
  const recs: string[] = [];

  const queroLer = books.filter((b) => b.reading_status === 'quero_ler').length;
  if (queroLer >= 5) {
    recs.push(`Você tem ${queroLer} livros na fila "quero ler" — que tal escolher o próximo?`);
  }

  const genreCounts = buildGenreDonut(books.filter((b) => b.reading_status === 'lido'));
  if (genreCounts.length > 0) {
    const favorite = genreCounts[0];
    recs.push(`Seu gênero favorito é ${favorite.genre} (${favorite.count} livro(s) lido(s)).`);
  }

  const unratedRead = books.filter((b) => b.reading_status === 'lido' && !b.rating).length;
  if (unratedRead > 0) {
    recs.push(`${unratedRead} livro(s) lido(s) sem avaliação — vale registrar sua nota.`);
  }

  const addedRecently = dailyData.reduce((sum, d) => sum + d.count, 0);
  if (addedRecently === 0) {
    recs.push('Nenhum livro adicionado nos últimos 30 dias.');
  }

  return recs;
}
