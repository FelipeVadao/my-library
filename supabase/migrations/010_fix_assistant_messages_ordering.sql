-- 010_fix_assistant_messages_ordering.sql
-- Bug: askLibraryAssistant saves the user question and assistant answer in a
-- single INSERT statement. Postgres's now() (used by created_at's DEFAULT)
-- returns the transaction start time, not a per-row clock reading — so both
-- rows in that one INSERT get an IDENTICAL created_at. Ordering by
-- created_at then ties arbitrarily, which is why the pair could come back
-- reversed after a reload. Fix: a bigserial column, whose nextval() is
-- evaluated once per row even within a single multi-row INSERT, giving a
-- stable, monotonically increasing insertion order regardless of timestamp
-- ties.
-- Also adds the DELETE policy needed for the new "apagar conversa" button —
-- there was no DELETE policy before, so deletes silently affected 0 rows.
-- Rode este bloco no SQL Editor do Supabase (depois da migration 009).

ALTER TABLE public.assistant_messages ADD COLUMN IF NOT EXISTS seq bigserial;

CREATE INDEX IF NOT EXISTS assistant_messages_operator_seq_idx
  ON public.assistant_messages (operator_id, seq DESC);

DROP INDEX IF EXISTS public.assistant_messages_operator_created_idx;

DROP POLICY IF EXISTS "operador_delete_own_assistant_messages" ON public.assistant_messages;
CREATE POLICY "operador_delete_own_assistant_messages" ON public.assistant_messages
  FOR DELETE USING (auth.uid() = operator_id);
