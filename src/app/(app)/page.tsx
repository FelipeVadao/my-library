import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReadingGoal } from '@/app/actions';
import type { Book } from '@/lib/supabase/types';
import {
  formatDailyData,
  formatGenreMonthHeatmap,
  formatRatingDistribution,
  buildAlerts,
  buildRecommendations,
  buildLoanedBooks,
  type DashboardMetricsRpc,
} from '@/lib/dashboardMetrics';

export const dynamic = 'force-dynamic';
import MetricCard from '@/components/MetricCard';
import BarCountChart from '@/components/BarCountChart';
import DailyChart from '@/components/DailyChart';
import RealtimeCounter from '@/components/RealtimeCounter';
import ReadingGoalGauge from '@/components/ReadingGoalGauge';
import ScanFunnel from '@/components/ScanFunnel';
import GenreMonthHeatmap from '@/components/GenreMonthHeatmap';
import GenreDonutChart from '@/components/GenreDonutChart';
import AlertsTable from '@/components/AlertsTable';
import RecommendationsList from '@/components/RecommendationsList';
import TopAuthorsList from '@/components/TopAuthorsList';
import CurrentlyReadingList from '@/components/CurrentlyReadingList';
import FavoritesShelf from '@/components/FavoritesShelf';

async function getMetrics(userId: string) {
  const supabase = await createClient();
  const [{ data: rpcData }, { data: currentlyReading }, { data: loaned }, { data: favorites }] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', { p_operator_id: userId }),
    supabase
      .from('books')
      .select('*')
      .eq('operator_id', userId)
      .eq('reading_status', 'lendo')
      .order('updated_at', { ascending: false }),
    supabase.from('books').select('*').eq('operator_id', userId).not('loaned_to', 'is', null),
    supabase
      .from('books')
      .select('*')
      .eq('operator_id', userId)
      .eq('favorite', true)
      .order('added_at', { ascending: false })
      .limit(10),
  ]);

  const m = rpcData as DashboardMetricsRpc;

  return {
    todayCount: m.todayCount,
    totalBooks: m.totalBooks,
    totalCopies: m.totalCopies,
    lidoCount: m.lidoCount,
    lendoCount: m.lendoCount,
    queroLerCount: m.queroLerCount,
    readThisYear: m.readThisYear,
    dailyData: formatDailyData(m.dailyData),
    genreMonthHeatmap: formatGenreMonthHeatmap(m.genreMonthHeatmap),
    ratingDistribution: formatRatingDistribution(m.ratingDistribution),
    genreDonut: m.genreDonut,
    topAuthors: m.topAuthors,
    currentlyReading: (currentlyReading ?? []) as Book[],
    favorites: (favorites ?? []) as Book[],
    alerts: buildAlerts((currentlyReading ?? []) as Book[]),
    loanedBooks: buildLoanedBooks((loaned ?? []) as Book[]),
    recommendations: buildRecommendations({
      queroLerCount: m.queroLerCount,
      topLidoGenre: m.topLidoGenre,
      unratedReadCount: m.unratedReadCount,
      dailyData: m.dailyData,
    }),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/scan');

  const metrics = await getMetrics(user.id);
  const goal = await getReadingGoal(user.id);

  return (
    <main className="min-h-screen bg-paper text-ink p-6">
      <div className="max-w-6xl mx-auto">
        <div className="lamp-glow mb-8">
          <h1 className="font-serif text-2xl font-bold">Dashboard</h1>
          <p className="text-ink-muted text-sm mt-1">Sua biblioteca pessoal de livros</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <ReadingGoalGauge value={metrics.readThisYear} initialGoal={goal} />
          <ScanFunnel
            title="Leituras em andamento"
            stages={[
              { name: 'Quero ler', value: metrics.queroLerCount, fill: 'var(--color-ink-muted)' },
              { name: 'Lendo', value: metrics.lendoCount, fill: 'var(--color-brass-strong)' },
              { name: 'Lido', value: metrics.lidoCount, fill: 'var(--color-forest)' },
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
          <CurrentlyReadingList books={metrics.currentlyReading} />
          <FavoritesShelf books={metrics.favorites} />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <BarCountChart data={metrics.ratingDistribution} title="Distribuição de notas (livros lidos)" />
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

        <TopAuthorsList authors={metrics.topAuthors} />
      </div>
    </main>
  );
}
