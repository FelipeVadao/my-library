import { describe, it, expect } from 'vitest';
import { buildBooksQuery, escapeIlikeTerm } from './bookQuery';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('escapeIlikeTerm', () => {
  it('escapes ilike wildcards and PostgREST filter-syntax special characters', () => {
    expect(escapeIlikeTerm('50% off, (sale)')).toBe('50\\% off\\, \\(sale\\)');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeIlikeTerm('Tolkien')).toBe('Tolkien');
  });
});

interface RecordedCall {
  method: string;
  args: unknown[];
}

function createFakeSupabase() {
  const calls: RecordedCall[] = [];
  const builder = {} as Record<string, (...args: unknown[]) => unknown>;
  for (const method of ['select', 'eq', 'or', 'in', 'gte', 'lte', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('buildBooksQuery', () => {
  it('scopes to the operator and defaults to added_at desc with no other filters', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1');

    expect(calls).toContainEqual({ method: 'from', args: ['books'] });
    expect(calls).toContainEqual({ method: 'select', args: ['*', undefined] });
    expect(calls).toContainEqual({ method: 'eq', args: ['operator_id', 'op-1'] });
    expect(calls).toContainEqual({ method: 'order', args: ['added_at', { ascending: false }] });
    expect(calls.find((c) => c.method === 'or')).toBeUndefined();
  });

  it('widens free-text search across title/author/genre/publisher and escapes it', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { text: '50% off, (sale)' });

    const orCall = calls.find((c) => c.method === 'or');
    expect(orCall?.args[0]).toBe(
      'title.ilike.%50\\% off\\, \\(sale\\)%,author.ilike.%50\\% off\\, \\(sale\\)%,genre.ilike.%50\\% off\\, \\(sale\\)%,publisher.ilike.%50\\% off\\, \\(sale\\)%'
    );
  });

  it('ignores blank/whitespace-only text without adding an or() clause', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { text: '   ' });
    expect(calls.find((c) => c.method === 'or')).toBeUndefined();
  });

  it('applies genre, status, favorite, rating, page-count and year filters', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', {
      genre: ['Ficção', 'Fantasia'],
      readingStatus: ['lido', 'lendo'],
      favorite: true,
      minRating: 4,
      minPageCount: 100,
      maxPageCount: 500,
      publishedYearFrom: 1950,
      publishedYearTo: 1999,
    });

    expect(calls).toContainEqual({ method: 'in', args: ['genre', ['Ficção', 'Fantasia']] });
    expect(calls).toContainEqual({ method: 'in', args: ['reading_status', ['lido', 'lendo']] });
    expect(calls).toContainEqual({ method: 'eq', args: ['favorite', true] });
    expect(calls).toContainEqual({ method: 'gte', args: ['rating', 4] });
    expect(calls).toContainEqual({ method: 'gte', args: ['page_count', 100] });
    expect(calls).toContainEqual({ method: 'lte', args: ['page_count', 500] });
    expect(calls).toContainEqual({ method: 'gte', args: ['published_year', 1950] });
    expect(calls).toContainEqual({ method: 'lte', args: ['published_year', 1999] });
  });

  it('omits filters that were not provided', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { minRating: 4 });

    expect(calls.find((c) => c.method === 'in')).toBeUndefined();
    expect(calls.find((c) => c.method === 'lte')).toBeUndefined();
    expect(calls).toContainEqual({ method: 'gte', args: ['rating', 4] });
  });

  it('converts limit/offset into a range() call', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { limit: 50, offset: 100 });
    expect(calls).toContainEqual({ method: 'range', args: [100, 149] });
  });

  it('defaults offset to 0 when only limit is given', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { limit: 50 });
    expect(calls).toContainEqual({ method: 'range', args: [0, 49] });
  });

  it('does not call range() when no limit is given (unbounded, for CSV export)', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1');
    expect(calls.find((c) => c.method === 'range')).toBeUndefined();
  });

  it('respects a custom sort field/direction', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', { sort: { field: 'title', direction: 'asc' } });
    expect(calls).toContainEqual({ method: 'order', args: ['title', { ascending: true }] });
  });

  it('passes select columns and count option through', () => {
    const { client, calls } = createFakeSupabase();
    buildBooksQuery(client, 'op-1', {}, { select: 'id,title', count: 'exact' });
    expect(calls).toContainEqual({ method: 'select', args: ['id,title', { count: 'exact' }] });
  });
});
