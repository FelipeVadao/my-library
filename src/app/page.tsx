import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Book } from '@/lib/supabase/types';
import {
  startOfDay,
  daysAgo,
  buildDailyData,
  buildGenreMonthHeatmap,
  buildRatingDistribution,
  buildGenreDonut,
  buildTopAuthors,
  buildAlerts,
  buildRecommendations,
  buildLoanedBooks,
} from '@/lib/dashboardMetrics';

export const dynamic = 'force-dynamic';
import MetricCard from '@/components/MetricCard';
import RatingDistributionChart from '@/components/RatingDistributionChart';
import DailyChart from '@/components/DailyChart';
import RealtimeCounter from '@/components/RealtimeCounter';
import ScoreGauge from '@/components/ScoreGauge';
import ScanFunnel from '@/components/ScanFunnel';
import GenreMonthHeatmap from '@/components/GenreMonthHeatmap';
import GenreDonutChart from '@/components/GenreDonutChart';
import AlertsTable from '@/components/AlertsTable';
import RecommendationsList from '@/components/RecommendationsList';
import Link from 'next/link';

const YEARLY_READING_GOAL = 12; // meta de livros lidos/ano usada no gauge — ajustável conforme a meta real

async function getMetrics(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('operator_id', userId);

  const books = (data ?? []) as Book[];

  const todayStart = startOfDay();
  const yearStartMs = new Date(new Date().getFullYear(), 0, 1).getTime();
  const thirtyDaysAgo = daysAgo(30);
  const sixMonthsAgo = daysAgo(180);

  const todayCount = books.filter((b) => b.added_at >= todayStart).length;
  const totalCopies = books.reduce((sum, b) => sum + b.copies, 0);
  const lidoCount = books.filter((b) => b.reading_status === 'lido').length;
  const lendoCount = books.filter((b) => b.reading_status === 'lendo').length;
  const queroLerCount = books.filter((b) => b.reading_status === 'quero_ler').length;
  const readThisYear = books.filter(
    (b) => b.reading_status === 'lido' && b.finished_at && new Date(b.finished_at).getTime() >= yearStartMs
  ).length;

  const dailyData = buildDailyData(books.filter((b) => b.added_at >= thirtyDaysAgo));

  return {
    todayCount,
    totalBooks: books.length,
    totalCopies,
    lidoCount,
    lendoCount,
    queroLerCount,
    readThisYear,
    dailyData,
    genreMonthHeatmap: buildGenreMonthHeatmap(books.filter((b) => b.added_at >= sixMonthsAgo)),
    ratingDistribution: buildRatingDistribution(books),
    genreDonut: buildGenreDonut(books),
    topAuthors: buildTopAuthors(books),
    alerts: buildAlerts(books),
    recommendations: buildRecommendations(books, dailyData),
    loanedBooks: buildLoanedBooks(books),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/scan');

  const metrics = await getMetrics(user.id);

  return (
    <main className="min-h-screen bg-paper text-ink p-6">
      <div className="max-w-6xl mx-auto">
        <div className="lamp-glow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold">My Library</h1>
            <p className="text-ink-muted text-sm mt-1">Sua biblioteca pessoal de livros</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/scan"
              className="text-sm text-ink-deep font-semibold px-4 py-2 rounded-md bg-brass-strong hover:bg-brass-strong-hover transition"
            >
              ← Abrir Scanner
            </Link>
            <Link
              href="/books"
              className="text-sm text-brass-strong hover:text-brass-strong-hover px-4 py-2 rounded-md border border-border hover:border-brass transition"
            >
              Meus livros
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <ScoreGauge
            value={metrics.readThisYear}
            max={YEARLY_READING_GOAL}
            label="Meta de leitura anual"
            sub={`${metrics.readThisYear} de ${YEARLY_READING_GOAL} livros lidos`}
          />
          <ScanFunnel
            title="Leituras em andamento"
            stages={[
              { name: 'Quero ler', value: metrics.queroLerCount, fill: '#B9A98C' },
              { name: 'Lendo', value: metrics.lendoCount, fill: '#C9A227' },
              { name: 'Lido', value: metrics.lidoCount, fill: '#74A15E' },
            ]}
            caption="Livros no status quero ler → lendo → lido."
          />
          <div className="grid grid-cols-2 gap-4">
            <RealtimeCounter initialCount={metrics.todayCount} operatorId={user.id} />
            <MetricCard label="Total de exemplares" value={metrics.totalCopies.toLocaleString('pt-BR')} />
            <MetricCard label="Livros lidos" value={metrics.lidoCount.toLocaleString('pt-BR')} />
            <MetricCard label="Lendo agora" value={metrics.lendoCount.toLocaleString('pt-BR')} />
            <div className="col-span-2">
              <MetricCard
                label="Total de livros"
                value={metrics.totalBooks.toLocaleString('pt-BR')}
                sub="registros na biblioteca"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <RatingDistributionChart data={metrics.ratingDistribution} />
          <DailyChart data={metrics.dailyData} />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <GenreMonthHeatmap
            genres={metrics.genreMonthHeatmap.genres}
            months={metrics.genreMonthHeatmap.months}
            matrix={metrics.genreMonthHeatmap.matrix}
          />
          <GenreDonutChart data={metrics.genreDonut} />
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <AlertsTable alerts={metrics.alerts} />
          </div>
          <RecommendationsList recommendations={metrics.recommendations} />
        </div>

        <div className="mb-6">
          <AlertsTable
            alerts={metrics.loanedBooks}
            title="Livros emprestados"
            emptyMessage="Nenhum livro emprestado no momento."
          />
        </div>

        <div className="rounded-lg border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)] bg-paper-card p-5">
          <h3 className="text-sm font-medium text-ink-muted mb-4">Top autores</h3>
          {metrics.topAuthors.length === 0 ? (
            <p className="text-ink-muted text-sm">Nenhum livro registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {metrics.topAuthors.map((a, i) => (
                <div
                  key={a.author}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-ink-muted text-sm w-5">{i + 1}</span>
                    <span className="text-sm text-ink">{a.author}</span>
                  </div>
                  <span className="text-sm font-semibold text-brass-strong">
                    {a.count.toLocaleString('pt-BR')} livro(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
