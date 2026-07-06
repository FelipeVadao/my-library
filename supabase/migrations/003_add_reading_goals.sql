-- 003_add_reading_goals.sql
-- Meta de leitura anual: cada leitor define sua própria meta de livros lidos por ano.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
CREATE TABLE IF NOT EXISTS public.reading_goals (
  operator_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  annual_goal  integer NOT NULL DEFAULT 12 CHECK (annual_goal >= 1),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reading_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operador_select_own_goal" ON public.reading_goals;
DROP POLICY IF EXISTS "operador_insert_own_goal" ON public.reading_goals;
DROP POLICY IF EXISTS "operador_update_own_goal" ON public.reading_goals;

CREATE POLICY "operador_select_own_goal" ON public.reading_goals
  FOR SELECT USING (auth.uid() = operator_id);
CREATE POLICY "operador_insert_own_goal" ON public.reading_goals
  FOR INSERT WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "operador_update_own_goal" ON public.reading_goals
  FOR UPDATE USING (auth.uid() = operator_id) WITH CHECK (auth.uid() = operator_id);
