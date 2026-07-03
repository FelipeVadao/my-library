-- =========================================================
-- My Library — Supabase schema
-- Execute este SQL no SQL Editor do seu projeto Supabase.
-- Reflete apenas o schema atual (biblioteca pessoal de livros) —
-- não contém histórico de migrações.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.books (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  isbn            text,
  title           text NOT NULL,
  author          text,
  publisher       text,
  published_year  integer,
  genre           text,
  synopsis        text,
  cover_url       text,
  copies          integer NOT NULL DEFAULT 1 CHECK (copies >= 1),
  reading_status  text NOT NULL DEFAULT 'quero_ler'
                    CHECK (reading_status IN ('quero_ler','lendo','lido')),
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  finished_at     timestamptz,
  loaned_to       text,
  loaned_at       timestamptz,
  added_at        timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_operator_idx      ON public.books (operator_id);
CREATE INDEX IF NOT EXISTS books_isbn_idx           ON public.books (isbn);
CREATE INDEX IF NOT EXISTS books_reading_status_idx ON public.books (reading_status);
CREATE INDEX IF NOT EXISTS books_added_at_idx       ON public.books (added_at DESC);
CREATE INDEX IF NOT EXISTS books_genre_idx          ON public.books (genre);
CREATE INDEX IF NOT EXISTS books_loaned_to_idx      ON public.books (loaned_to);

-- =========================================================
-- Row Level Security (RLS)
-- =========================================================
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operador_insert_own_books" ON public.books;
DROP POLICY IF EXISTS "operador_select_own_books" ON public.books;
DROP POLICY IF EXISTS "operador_update_own_books" ON public.books;
DROP POLICY IF EXISTS "operador_delete_own_books" ON public.books;

CREATE POLICY "operador_insert_own_books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "operador_select_own_books" ON public.books
  FOR SELECT USING (auth.uid() = operator_id);
CREATE POLICY "operador_update_own_books" ON public.books
  FOR UPDATE USING (auth.uid() = operator_id) WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "operador_delete_own_books" ON public.books
  FOR DELETE USING (auth.uid() = operator_id);

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;

-- =========================================================
-- Storage: bucket para foto de capa (fallback quando as APIs de
-- livro não retornam cover art). Bucket público para leitura
-- (thumbnails renderizados sem signed URL); escrita restrita à
-- própria pasta do operador (path convention: {operator_id}/{uuid}.jpg).
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "operador_upload_own_covers" ON storage.objects;
DROP POLICY IF EXISTS "public_read_covers" ON storage.objects;
DROP POLICY IF EXISTS "operador_delete_own_covers" ON storage.objects;

CREATE POLICY "operador_upload_own_covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "public_read_covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'book-covers');
CREATE POLICY "operador_delete_own_covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
