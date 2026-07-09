-- 008_add_book_embeddings.sql
-- RAG para o assistente de IA: embedding semântico por livro (título +
-- autor + gênero + sinopse), índice HNSW por distância de cosseno, e uma
-- função de busca por similaridade via RPC. Mesmo padrão de segurança das
-- demais RPCs deste projeto (005/006/007): LANGUAGE sql STABLE SECURITY
-- INVOKER, search_path travado, REVOKE/GRANT explícitos.
-- Rode este bloco no SQL Editor do Supabase (banco existente).

-- Verificação opcional antes de aplicar (esperado: nenhuma linha, já que é
-- o primeiro uso de pgvector no projeto):
--   SELECT extname, nspname FROM pg_extension e
--     JOIN pg_namespace n ON n.oid = e.extnamespace WHERE extname = 'vector';

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

CREATE INDEX IF NOT EXISTS books_embedding_hnsw_idx
  ON public.books
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS books_embedding_null_idx
  ON public.books (operator_id)
  WHERE embedding IS NULL;

CREATE OR REPLACE FUNCTION public.match_books(
  p_operator_id uuid,
  p_query_embedding extensions.vector(768),
  p_match_count int DEFAULT 20
)
RETURNS TABLE (
  id             uuid,
  title          text,
  author         text,
  genre          text,
  reading_status text,
  rating         smallint,
  added_at       timestamptz,
  finished_at    timestamptz,
  page_count     integer,
  favorite       boolean,
  similarity     float8
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    b.id, b.title, b.author, b.genre, b.reading_status, b.rating,
    b.added_at, b.finished_at, b.page_count, b.favorite,
    1 - (b.embedding <=> p_query_embedding) AS similarity
  FROM public.books b
  WHERE b.operator_id = p_operator_id AND b.embedding IS NOT NULL
  ORDER BY b.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 200)
$$;

REVOKE ALL ON FUNCTION public.match_books(uuid, extensions.vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_books(uuid, extensions.vector, int) TO authenticated;
