export type ReadingStatus = 'quero_ler' | 'lendo' | 'lido';

export type Book = {
  id: string;
  operator_id: string;
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
  added_at: string;
  updated_at: string;
};
