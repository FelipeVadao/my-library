-- 011_add_books_keyset_pagination_index.sql
-- Fase 7 (performance hardening): índice composto casando exatamente o
-- formato da nova query de keyset pagination em bookQuery.ts —
-- WHERE operator_id = ? AND (added_at, id) < (?, ?) ORDER BY added_at DESC, id DESC.
-- Substitui books_added_at_idx (coluna única), que fica redundante: toda
-- query por buildBooksQuery já filtra por operator_id primeiro.
-- Rode este bloco no SQL Editor do Supabase.

CREATE INDEX IF NOT EXISTS books_operator_added_at_id_idx
  ON public.books (operator_id, added_at DESC, id DESC);

DROP INDEX IF EXISTS public.books_added_at_idx;
