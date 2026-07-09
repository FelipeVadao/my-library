import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  formatDecadeCounts,
  formatLanguageCounts,
  formatMonthlySeries,
  type AnalyticsDetailRpc,
} from '@/lib/analyticsMetrics';

export const dynamic = 'force-dynamic';
import MetricCard from '@/components/MetricCard';
import BarCountChart from '@/components/BarCountChart';
import DailyChart from '@/components/DailyChart';
import TopAuthorsList from '@/components/TopAuthorsList';

async function getAnalytics(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_analytics_detail', { p_operator_id: userId });
  const m = data as AnalyticsDetailRpc;

  return {
    decadeCounts: formatDecadeCounts(m.decadeCounts),
    languageCounts: formatLanguageCounts(m.languageCounts),
    collectionGrowth: formatMonthlySeries(m.collectionGrowth),
    readingEvolution: formatMonthlySeries(m.readingEvolution),
    totalPagesRead: m.totalPagesRead,
    avgPagesPerBook: m.avgPagesPerBook,
    topAuthors: m.topAuthors,
  };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/scan');

  const metrics = await getAnalytics(user.id);

  return (
    <main className="min-h-screen bg-paper text-ink p-6">
      <div className="max-w-6xl mx-auto">
        <div className="lamp-glow mb-8">
          <h1 className="font-serif text-2xl font-bold">Analytics</h1>
          <p className="text-ink-muted text-sm mt-1">Uma análise mais profunda da sua coleção</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <MetricCard
            label="Páginas lidas"
            value={metrics.totalPagesRead.toLocaleString('pt-BR')}
            sub="soma dos livros marcados como lidos"
          />
          <MetricCard
            label="Média de páginas por livro"
            value={metrics.avgPagesPerBook != null ? metrics.avgPagesPerBook.toLocaleString('pt-BR') : '—'}
            sub="entre os livros com nº de páginas preenchido"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <BarCountChart data={metrics.decadeCounts} title="Livros por década de publicação" />
          <BarCountChart data={metrics.languageCounts} title="Livros por idioma" />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DailyChart data={metrics.collectionGrowth} title="Crescimento da coleção" />
          <DailyChart data={metrics.readingEvolution} title="Evolução das leituras (livros concluídos por mês)" />
        </div>

        <TopAuthorsList authors={metrics.topAuthors} />
      </div>
    </main>
  );
}
