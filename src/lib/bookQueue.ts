import type { ReadingStatus } from './supabase/types';

export interface QueuedBook {
  id: string;
  isbn: string | null;
  title: string;
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
  favorite: boolean;
  started_at: string | null;
  page_count: number | null;
  current_page: number | null;
  language: string | null;
  added_at: string;
  operator_id: string;
}

const KEY = 'my_library_book_queue';

export function enqueue(book: QueuedBook): void {
  const queue = getAll();
  queue.push(book);
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export function getAll(): QueuedBook[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function removeByIds(ids: string[]): void {
  const remaining = getAll().filter((b) => !ids.includes(b.id));
  localStorage.setItem(KEY, JSON.stringify(remaining));
}

export function pendingCount(): number {
  return getAll().length;
}
