-- 004_add_reading_tracking_fields.sql
-- Campos de acompanhamento de leitura: favorito, data de início, páginas
-- (total e atual, para progresso) e idioma. Aditivo, sem backfill obrigatório.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS favorite     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS page_count   integer CHECK (page_count IS NULL OR page_count > 0),
  ADD COLUMN IF NOT EXISTS current_page integer CHECK (current_page IS NULL OR current_page >= 0),
  ADD COLUMN IF NOT EXISTS language     text;

CREATE INDEX IF NOT EXISTS books_favorite_idx ON public.books (operator_id) WHERE favorite = true;
