export interface BookLookupResult {
  title: string;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  genre: string | null;
  synopsis: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  language: string | null;
}

// Open Library's response time varies widely in practice (observed 1.7s-9.1s) —
// 6s was cutting off successful responses before they arrived.
const LOOKUP_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractYear(dateLike: string | undefined | null): number | null {
  const match = dateLike?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  categories?: string[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  pageCount?: number;
  language?: string;
}

interface GoogleBooksResponse {
  items?: Array<{ volumeInfo?: GoogleVolumeInfo }>;
}

function mapGoogleVolumeInfo(info: GoogleVolumeInfo | undefined): BookLookupResult | null {
  if (!info?.title) return null;
  return {
    title: info.title,
    author: info.authors?.join(', ') ?? null,
    publisher: info.publisher ?? null,
    publishedYear: extractYear(info.publishedDate),
    genre: info.categories?.[0] ?? null,
    synopsis: info.description ?? null,
    coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
    pageCount: info.pageCount ?? null,
    language: info.language ?? null,
  };
}

function googleBooksKeyParam(): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
  return apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
}

async function lookupGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${googleBooksKeyParam()}`
  );
  if (!res) return null;

  const data = (await res.json().catch(() => null)) as GoogleBooksResponse | null;
  return mapGoogleVolumeInfo(data?.items?.[0]?.volumeInfo);
}

// Used as a fallback when a book has no readable ISBN (e.g. AI cover
// recognition only extracts title/author) — deliberately Google-Books-only,
// unlike lookupIsbn's dual-source approach: title/author matching is already
// fuzzier than exact-ISBN matching, so a second fuzzy source would compound
// ambiguity rather than provide a safety net.
export async function searchByTitleAuthor(title: string, author: string | null): Promise<BookLookupResult | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  let q = `intitle:${encodeURIComponent(trimmedTitle)}`;
  if (author?.trim()) q += `+inauthor:${encodeURIComponent(author.trim())}`;

  const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${q}${googleBooksKeyParam()}`);
  if (!res) return null;

  const data = (await res.json().catch(() => null)) as GoogleBooksResponse | null;
  return mapGoogleVolumeInfo(data?.items?.[0]?.volumeInfo);
}

interface OpenLibraryEntry {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  subjects?: Array<{ name?: string }>;
  cover?: { small?: string; medium?: string; large?: string };
  number_of_pages?: number;
}

async function lookupOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const res = await fetchWithTimeout(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`
  );
  if (!res) return null;

  const data = (await res.json().catch(() => null)) as Record<string, OpenLibraryEntry> | null;
  const entry = data?.[`ISBN:${isbn}`];
  if (!entry?.title) return null;

  return {
    title: entry.title,
    author: entry.authors?.map((a) => a.name).filter(Boolean).join(', ') || null,
    publisher: entry.publishers?.[0]?.name ?? null,
    publishedYear: extractYear(entry.publish_date),
    genre: entry.subjects?.[0]?.name ?? null,
    synopsis: null,
    coverUrl: entry.cover?.large ?? entry.cover?.medium ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    pageCount: entry.number_of_pages ?? null,
    // Open Library's jscmd=data payload doesn't include a language field.
    language: null,
  };
}

export async function lookupIsbn(isbn: string): Promise<BookLookupResult | null> {
  // Run both lookups concurrently rather than waiting for Google to fail
  // first — keeps worst-case latency down to whichever source is slower,
  // not the sum of both.
  const [fromGoogle, fromOpenLibrary] = await Promise.all([
    lookupGoogleBooks(isbn),
    lookupOpenLibrary(isbn),
  ]);

  return fromGoogle ?? fromOpenLibrary;
}
