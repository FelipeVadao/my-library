'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { buildBooksQuery } from '@/lib/bookQuery';
import type { DashboardMetricsRpc } from '@/lib/dashboardMetrics';
import {
  buildLibraryContext,
  BOOK_CONTEXT_COLUMNS,
  type BookContextRow,
  type LibraryStatsSummary,
} from '@services/ai/libraryContext';
import { embedText, embedManyTexts, bookToEmbeddingText } from '@services/ai/embeddings';
import { answerLibraryQuestion, type ChatMessage, type LibraryAssistantAnswer } from '@services/ai/gemini.service';
import { buildLibraryTools } from './tools';

const MAX_BOOKS_IN_CONTEXT = 2000; // fallback-path cap, unchanged from before RAG
const MAX_HISTORY_MESSAGES = 10;
const RAG_TOP_K = 20;
const MAX_EMBEDDING_BACKFILL_PER_REQUEST = 20;

// Best-effort, lazy embedding backfill — no cron/trigger/Edge Function, and
// none of the 3 existing book-save paths (EditBookModal, scan/page.tsx,
// bookQueue.ts's offline sync) are touched. Whatever's still missing an
// embedding just gets picked up on a future question.
async function backfillMissingEmbeddings(supabase: SupabaseClient, operatorId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, genre, synopsis')
      .eq('operator_id', operatorId)
      .is('embedding', null)
      .limit(MAX_EMBEDDING_BACKFILL_PER_REQUEST);
    if (error || !data || data.length === 0) return;

    const embeddings = await embedManyTexts(data.map(bookToEmbeddingText));
    if (!embeddings) return;

    // operator_id/title included even though this is logically an update —
    // Postgres validates NOT NULL on the proposed row for INSERT ... ON
    // CONFLICT DO UPDATE even when it ends up executing the UPDATE branch.
    const rows = data.map((b, i) => ({ id: b.id, operator_id: operatorId, title: b.title, embedding: embeddings[i] }));
    await supabase.from('books').upsert(rows, { onConflict: 'id' });
  } catch {
    // Best-effort only — never blocks the main assistant flow.
  }
}

async function fetchFallbackBooks(supabase: SupabaseClient, operatorId: string) {
  const { data, count, error } = await buildBooksQuery(
    supabase,
    operatorId,
    { limit: MAX_BOOKS_IN_CONTEXT },
    { select: BOOK_CONTEXT_COLUMNS, count: 'exact' }
  );
  return {
    books: error ? [] : ((data ?? []) as unknown as BookContextRow[]),
    totalCount: error ? undefined : (count ?? undefined),
    dbError: !!error,
  };
}

// Unlike most actions in src/app/actions.ts (which rely on RLS alone), this
// needs an explicit getUser() call regardless of RLS, purely to obtain
// user.id as the operatorId buildBooksQuery/RPCs require — RLS still
// independently enforces the same scoping at the DB layer.
export async function askLibraryAssistant(
  question: string,
  history: ChatMessage[] = []
): Promise<LibraryAssistantAnswer> {
  const trimmed = question.trim();
  if (!trimmed) return { answer: null, error: 'Digite uma pergunta.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { answer: null, error: 'Não autenticado.' };

  const [, { data: rpcData }, questionEmbedding] = await Promise.all([
    backfillMissingEmbeddings(supabase, user.id),
    supabase.rpc('get_dashboard_metrics', { p_operator_id: user.id }),
    embedText(trimmed),
  ]);
  const metrics = rpcData as DashboardMetricsRpc | null;
  const stats: LibraryStatsSummary | undefined = metrics
    ? {
        totalBooks: metrics.totalBooks,
        lidoCount: metrics.lidoCount,
        lendoCount: metrics.lendoCount,
        queroLerCount: metrics.queroLerCount,
        readThisYear: metrics.readThisYear,
      }
    : undefined;

  let books: BookContextRow[] = [];
  let totalCount: number | undefined;
  let selectionMode: 'recent' | 'relevant' = 'recent';
  let fallbackDbError = false;

  if (questionEmbedding) {
    const { data: matchData, error: matchError } = await supabase.rpc('match_books', {
      p_operator_id: user.id,
      p_query_embedding: questionEmbedding,
      p_match_count: RAG_TOP_K,
    });
    if (!matchError && matchData && matchData.length > 0) {
      books = matchData as BookContextRow[];
      totalCount = stats?.totalBooks;
      selectionMode = 'relevant';
    }
  }

  // Covers all 3 "RAG unusable" cases in one guard: no embedding, RPC
  // error, or zero matches (which — since match_books has no similarity
  // threshold — can only mean nothing is embedded yet, not an empty
  // library; falling back here avoids ever claiming the library is empty
  // when it isn't).
  if (selectionMode === 'recent' && books.length === 0) {
    const fallback = await fetchFallbackBooks(supabase, user.id);
    books = fallback.books;
    totalCount = fallback.totalCount;
    fallbackDbError = fallback.dbError;
  }

  if (fallbackDbError && !stats) {
    return { answer: null, error: 'Não foi possível carregar sua biblioteca.' };
  }

  const context = buildLibraryContext(books, { totalCount, stats, selectionMode });
  const tools = buildLibraryTools(supabase, user.id);

  return answerLibraryQuestion(trimmed, context, history.slice(-MAX_HISTORY_MESSAGES), tools);
}
