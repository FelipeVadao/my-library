-- 001_add_loan_fields.sql
-- Rastreio de empréstimo: nome de quem pegou o livro + data do empréstimo.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS loaned_to text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS loaned_at timestamptz;
CREATE INDEX IF NOT EXISTS books_loaned_to_idx ON public.books (loaned_to);
