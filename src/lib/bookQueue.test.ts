// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, getAll, removeByIds, pendingCount, type QueuedBook } from './bookQueue';

const STORAGE_KEY = 'my_library_book_queue';

function makeBook(overrides: Partial<QueuedBook> = {}): QueuedBook {
  return {
    id: 'book-1',
    isbn: '1234567890',
    title: 'Test Book',
    author: 'Test Author',
    publisher: null,
    published_year: null,
    genre: null,
    synopsis: null,
    cover_url: null,
    copies: 1,
    reading_status: 'quero_ler',
    rating: null,
    finished_at: null,
    favorite: false,
    started_at: null,
    page_count: null,
    current_page: null,
    language: null,
    added_at: new Date().toISOString(),
    operator_id: 'user-1',
    ...overrides,
  };
}

describe('bookQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when no queue has been persisted', () => {
    expect(getAll()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it('enqueue persists the book and is readable via getAll', () => {
    const book = makeBook();
    enqueue(book);

    expect(getAll()).toEqual([book]);
    expect(pendingCount()).toBe(1);
  });

  it('enqueue does not deduplicate books with the same id', () => {
    const book = makeBook();
    enqueue(book);
    enqueue(book);

    expect(getAll()).toHaveLength(2);
    expect(pendingCount()).toBe(2);
  });

  it('getAll returns an empty array when the stored value is corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(getAll()).toEqual([]);
  });

  it('removeByIds removes only the matching entries', () => {
    const bookA = makeBook({ id: 'a' });
    const bookB = makeBook({ id: 'b' });
    const bookC = makeBook({ id: 'c' });
    enqueue(bookA);
    enqueue(bookB);
    enqueue(bookC);

    removeByIds(['a', 'c']);

    expect(getAll()).toEqual([bookB]);
  });

  it('removeByIds is a no-op when no ids match', () => {
    const book = makeBook();
    enqueue(book);

    removeByIds(['does-not-exist']);

    expect(getAll()).toEqual([book]);
  });

  it('persists under the current (non-legacy) storage key', () => {
    enqueue(makeBook());
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('registra_book_queue')).toBeNull();
  });
});
