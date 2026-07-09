import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReadingStatus } from './supabase/types';

export type BookSortField = 'added_at' | 'title' | 'author' | 'published_year' | 'rating' | 'page_count';

export interface BookFilter {
  text?: string;
  genre?: string[];
  readingStatus?: ReadingStatus[];
  favorite?: boolean;
  minRating?: number;
  minPageCount?: number;
  maxPageCount?: number;
  publishedYearFrom?: number;
  publishedYearTo?: number;
  sort?: { field: BookSortField; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export interface BuildBooksQueryOptions {
  select?: string;
  count?: 'exact' | null;
}

const ILIKE_SPECIAL_CHARS = /[%_,()]/g;

export function escapeIlikeTerm(term: string): string {
  return term.replace(ILIKE_SPECIAL_CHARS, (match) => `\\${match}`);
}

export function buildBooksQuery(
  supabase: SupabaseClient,
  operatorId: string,
  filter: BookFilter = {},
  options: BuildBooksQueryOptions = {}
) {
  const { select = '*', count = null } = options;

  let query = supabase
    .from('books')
    .select(select, count ? { count } : undefined)
    .eq('operator_id', operatorId);

  const text = filter.text?.trim();
  if (text) {
    const escaped = escapeIlikeTerm(text);
    query = query.or(
      `title.ilike.%${escaped}%,author.ilike.%${escaped}%,genre.ilike.%${escaped}%,publisher.ilike.%${escaped}%`
    );
  }
  if (filter.genre?.length) query = query.in('genre', filter.genre);
  if (filter.readingStatus?.length) query = query.in('reading_status', filter.readingStatus);
  if (filter.favorite !== undefined) query = query.eq('favorite', filter.favorite);
  if (filter.minRating !== undefined) query = query.gte('rating', filter.minRating);
  if (filter.minPageCount !== undefined) query = query.gte('page_count', filter.minPageCount);
  if (filter.maxPageCount !== undefined) query = query.lte('page_count', filter.maxPageCount);
  if (filter.publishedYearFrom !== undefined) query = query.gte('published_year', filter.publishedYearFrom);
  if (filter.publishedYearTo !== undefined) query = query.lte('published_year', filter.publishedYearTo);

  const sort = filter.sort ?? { field: 'added_at' as const, direction: 'desc' as const };
  query = query.order(sort.field, { ascending: sort.direction === 'asc' });

  if (filter.limit !== undefined) {
    const offset = filter.offset ?? 0;
    query = query.range(offset, offset + filter.limit - 1);
  }

  return query;
}
