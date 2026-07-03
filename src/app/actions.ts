'use server';

import { createClient } from '@/lib/supabase/server';

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
