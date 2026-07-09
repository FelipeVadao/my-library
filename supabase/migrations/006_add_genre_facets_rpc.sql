-- 006_add_genre_facets_rpc.sql
-- Lista de gêneros do operador com contagem, usada para popular os chips de
-- filtro de gênero em /books. Livros sem gênero (nulo/vazio) ficam de fora —
-- não faz sentido oferecer um chip "Sem gênero" que exigiria tratar NULL
-- como valor de filtro especial no lado da aplicação.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
CREATE OR REPLACE FUNCTION public.get_genre_facets(p_operator_id uuid)
RETURNS TABLE(genre text, book_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT btrim(genre) AS genre, count(*) AS book_count
  FROM public.books
  WHERE operator_id = p_operator_id AND NULLIF(btrim(genre), '') IS NOT NULL
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_genre_facets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_genre_facets(uuid) TO authenticated;
