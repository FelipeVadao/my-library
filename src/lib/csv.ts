import type { Book } from './supabase/types';

export function csvField(value: string | number | null | undefined): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(books: Book[]): string {
  const header = 'id,title,author,isbn,copies,reading_status,rating,added_at';
  const rows = books.map((b) =>
    [b.id, b.title, b.author, b.isbn, b.copies, b.reading_status, b.rating, b.added_at]
      .map(csvField)
      .join(',')
  );
  return [header, ...rows].join('\n');
}
