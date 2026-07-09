import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupIsbn } from './booksApi';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function rejectedJsonResponse(ok = true): Response {
  return {
    ok,
    json: () => Promise.reject(new Error('invalid json')),
  } as unknown as Response;
}

const GOOGLE_URL = /googleapis\.com/;

describe('lookupIsbn', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('prefers the Google Books result when both sources succeed', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (GOOGLE_URL.test(url)) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                volumeInfo: {
                  title: 'Google Title',
                  authors: ['Author A', 'Author B'],
                  publisher: 'Google Publisher',
                  publishedDate: '2019-03-01',
                  description: 'Google synopsis',
                  categories: ['Fiction'],
                  imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
                  pageCount: 320,
                  language: 'en',
                },
              },
            ],
          })
        );
      }
      return Promise.resolve(jsonResponse({ 'ISBN:123': { title: 'Open Library Title' } }));
    });

    const result = await lookupIsbn('123');

    expect(result).toEqual({
      title: 'Google Title',
      author: 'Author A, Author B',
      publisher: 'Google Publisher',
      publishedYear: 2019,
      genre: 'Fiction',
      synopsis: 'Google synopsis',
      coverUrl: 'https://books.google.com/cover.jpg',
      pageCount: 320,
      language: 'en',
    });
  });

  it('falls back to Open Library when Google Books has no title', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (GOOGLE_URL.test(url)) {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      return Promise.resolve(
        jsonResponse({
          'ISBN:456': {
            title: 'Open Library Title',
            authors: [{ name: 'OL Author' }],
            publishers: [{ name: 'OL Publisher' }],
            publish_date: 'March 2020',
            subjects: [{ name: 'Sci-Fi' }],
            number_of_pages: 250,
          },
        })
      );
    });

    const result = await lookupIsbn('456');

    expect(result).toEqual({
      title: 'Open Library Title',
      author: 'OL Author',
      publisher: 'OL Publisher',
      publishedYear: 2020,
      genre: 'Sci-Fi',
      synopsis: null,
      coverUrl: 'https://covers.openlibrary.org/b/isbn/456-L.jpg',
      pageCount: 250,
      language: null,
    });
  });

  it('returns null when both sources fail to find the book', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (GOOGLE_URL.test(url)) return Promise.resolve(jsonResponse({ items: [] }));
      return Promise.resolve(jsonResponse({}));
    });

    const result = await lookupIsbn('000');
    expect(result).toBeNull();
  });

  it('returns null when fetch rejects (network error)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));

    const result = await lookupIsbn('789');
    expect(result).toBeNull();
  });

  it('treats a non-ok response as not found', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, false)));

    const result = await lookupIsbn('111');
    expect(result).toBeNull();
  });

  it('treats a response whose body fails to parse as not found', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(rejectedJsonResponse()));

    const result = await lookupIsbn('222');
    expect(result).toBeNull();
  });

  it('appends the Google Books API key to the request URL when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY', 'test-key');
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ items: [] })));

    await lookupIsbn('333');

    const googleCall = fetchMock.mock.calls.find(([url]) => GOOGLE_URL.test(url as string));
    expect(googleCall?.[0]).toContain('&key=test-key');
  });
});
