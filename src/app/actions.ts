'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Book, ReadingStatus } from '@/lib/supabase/types';

export type UpdateBookInput = Omit<Book, 'id' | 'operator_id' | 'added_at' | 'updated_at'>;

// Dashboard/analytics cache their RPC results with a short TTL (see
// unstable_cache in those pages) — this forces an immediate refresh after
// any Server Action that changes books data. Book creation from /scan is a
// direct client-side insert (not a Server Action, needed for the offline
// queue), so it isn't covered here and stays on the TTL alone.
function revalidateBookViews() {
  revalidatePath('/');
  revalidatePath('/analytics');
}

export async function updateBook(id: string, input: UpdateBookInput): Promise<{ error: string | null }> {
  const title = input.title.trim();
  if (!title) return { error: 'Título é obrigatório.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({
      title,
      isbn: input.isbn,
      author: input.author,
      publisher: input.publisher,
      published_year: input.published_year,
      genre: input.genre,
      synopsis: input.synopsis,
      reader_summary: input.reader_summary,
      cover_url: input.cover_url,
      copies: Math.max(1, Math.trunc(input.copies) || 1),
      reading_status: input.reading_status,
      rating: input.reading_status === 'lido' ? input.rating : null,
      finished_at: input.reading_status === 'lido' ? input.finished_at : null,
      loaned_to: input.loaned_to,
      loaned_at: input.loaned_to ? input.loaned_at : null,
      favorite: input.favorite,
      started_at: input.reading_status !== 'quero_ler' ? input.started_at : null,
      page_count: input.page_count,
      current_page: input.reading_status !== 'quero_ler' ? input.current_page : null,
      language: input.language,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function deleteBook(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function deleteAllBooks(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function markBookLoaned(id: string, loanedTo: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({ loaned_to: loanedTo, loaned_at: new Date().toISOString() })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function clearLoan(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({ loaned_to: null, loaned_at: null })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function updateReadingStatus(id: string, status: ReadingStatus): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({
      reading_status: status,
      finished_at: status === 'lido' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function rateBook(id: string, rating: number): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const clamped = Math.min(5, Math.max(1, Math.trunc(rating)));
  const { error } = await supabase
    .from('books')
    .update({ rating: clamped, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

export async function toggleBookFavorite(id: string, favorite: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({ favorite, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (!error) revalidateBookViews();
  return { error: error?.message ?? null };
}

const DEFAULT_READING_GOAL = 12;

export async function getReadingGoal(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reading_goals')
    .select('annual_goal')
    .eq('operator_id', userId)
    .maybeSingle();
  return data?.annual_goal ?? DEFAULT_READING_GOAL;
}

export async function updateReadingGoal(goal: number): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const annualGoal = Math.max(1, Math.trunc(goal) || 1);
  const { error } = await supabase
    .from('reading_goals')
    .upsert({ operator_id: user.id, annual_goal: annualGoal, updated_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}
