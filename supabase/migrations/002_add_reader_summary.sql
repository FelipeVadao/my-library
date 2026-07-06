-- 002_add_reader_summary.sql
-- Resumo do leitor: interpretação pessoal do livro, escrita pelo próprio leitor.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS reader_summary text;
ALTER TABLE public.books ADD CONSTRAINT books_reader_summary_length
  CHECK (char_length(reader_summary) <= 2000);
