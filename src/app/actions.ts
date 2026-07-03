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
