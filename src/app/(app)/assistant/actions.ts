'use server';

import { createClient } from '@/lib/supabase/server';
import { buildBooksQuery } from '@/lib/bookQuery';
import { buildLibraryContext, BOOK_CONTEXT_COLUMNS, type BookContextRow } from '@services/ai/libraryContext';
import { answerLibraryQuestion, type ChatMessage, type LibraryAssistantAnswer } from '@services/ai/gemini.service';
import { buildLibraryTools } from './tools';

const MAX_BOOKS_IN_CONTEXT = 2000;
const MAX_HISTORY_MESSAGES = 10;

// Unlike most actions in src/app/actions.ts (which rely on RLS alone), this
// needs an explicit getUser() call regardless of RLS, purely to obtain
// user.id as the operatorId buildBooksQuery requires — RLS still
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

  const { data, count, error: dbError } = await buildBooksQuery(
    supabase,
    user.id,
    { limit: MAX_BOOKS_IN_CONTEXT },
    { select: BOOK_CONTEXT_COLUMNS, count: 'exact' }
  );
  if (dbError) return { answer: null, error: 'Não foi possível carregar sua biblioteca.' };

  const books = (data ?? []) as unknown as BookContextRow[];
  const context = buildLibraryContext(books, { totalCount: count ?? books.length });
  const tools = buildLibraryTools(supabase, user.id);

  return answerLibraryQuestion(trimmed, context, history.slice(-MAX_HISTORY_MESSAGES), tools);
}
