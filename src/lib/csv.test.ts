import { describe, it, expect } from 'vitest';
import { csvField, toCSV } from './csv';
import type { Book } from './supabase/types';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    operator_id: 'user-1',
    isbn: '1234567890',
    title: 'Test Book',
    author: 'Test Author',
    publisher: null,
    published_year: null,
    genre: null,
    synopsis: null,
    reader_summary: null,
    cover_url: null,
    copies: 1,
    reading_status: 'lido',
    rating: 5,
    finished_at: null,
    loaned_to: null,
    loaned_at: null,
    favorite: false,
    started_at: null,
    page_count: null,
    current_page: null,
    language: null,
    added_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('csvField', () => {
  it('returns plain text unchanged', () => {
    expect(csvField('hello')).toBe('hello');
  });

  it('quotes values containing a comma', () => {
    expect(csvField('Doe, John')).toBe('"Doe, John"');
  });

  it('quotes and escapes embedded double quotes', () => {
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes values containing a newline', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('converts null and undefined to an empty string', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('stringifies numbers', () => {
    expect(csvField(42)).toBe('42');
  });
});

describe('toCSV', () => {
  it('produces only the header row for an empty list', () => {
    expect(toCSV([])).toBe('id,title,author,isbn,copies,reading_status,rating,added_at');
  });

  it('produces one escaped row per book, in column order', () => {
    const books = [
      makeBook({ id: '1', title: 'Book One', author: 'Author, One' }),
      makeBook({ id: '2', title: 'Book Two', author: null, rating: null }),
    ];

    const csv = toCSV(books);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('id,title,author,isbn,copies,reading_status,rating,added_at');
    expect(lines[1]).toBe('1,Book One,"Author, One",1234567890,1,lido,5,2026-01-01T00:00:00.000Z');
    expect(lines[2]).toBe('2,Book Two,,1234567890,1,lido,,2026-01-01T00:00:00.000Z');
  });
});
