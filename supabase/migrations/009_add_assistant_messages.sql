-- 009_add_assistant_messages.sql
-- Memória persistente do assistente de IA: histórico único e contínuo por
-- usuário (sem conversas separadas). CRUD direto, sem RPC — mesmo padrão de
-- src/app/actions.ts para updates simples em public.books.
-- Rode este bloco no SQL Editor do Supabase (banco existente).

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role         text NOT NULL CHECK (role IN ('user','assistant')),
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_messages_operator_created_idx
  ON public.assistant_messages (operator_id, created_at DESC);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operador_select_own_assistant_messages" ON public.assistant_messages;
DROP POLICY IF EXISTS "operador_insert_own_assistant_messages" ON public.assistant_messages;

CREATE POLICY "operador_select_own_assistant_messages" ON public.assistant_messages
  FOR SELECT USING (auth.uid() = operator_id);
CREATE POLICY "operador_insert_own_assistant_messages" ON public.assistant_messages
  FOR INSERT WITH CHECK (auth.uid() = operator_id);
