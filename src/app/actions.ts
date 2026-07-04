'use server';

import { createClient } from '@/lib/supabase/server';
import type { ReadingStatus } from '@/lib/supabase/types';

export type UpdateBookInput = {
  title: string;
  isbn: string | null;
  author: string | null;
  publisher: string | null;
  published_year: number | null;
  genre: string | null;
  synopsis: string | null;
  cover_url: string | null;
  copies: number;
  reading_status: ReadingStatus;
  rating: number | null;
  finished_at: string | null;
  loaned_to: string | null;
  loaned_at: string | null;
};

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
      cover_url: input.cover_url,
      copies: Math.max(1, Math.trunc(input.copies) || 1),
      reading_status: input.reading_status,
      rating: input.reading_status === 'lido' ? input.rating : null,
      finished_at: input.reading_status === 'lido' ? input.finished_at : null,
      loaned_to: input.loaned_to,
      loaned_at: input.loaned_to ? input.loaned_at : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteBook(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('books').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteAllBooks(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  return { error: error?.message ?? null };
}

export async function markBookLoaned(id: string, loanedTo: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({ loaned_to: loanedTo, loaned_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function clearLoan(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('books')
    .update({ loaned_to: null, loaned_at: null })
    .eq('id', id);
  return { error: error?.message ?? null };
}
