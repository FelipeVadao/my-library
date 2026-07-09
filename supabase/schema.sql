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
  reader_summary  text CHECK (char_length(reader_summary) <= 2000),
  cover_url       text,
  copies          integer NOT NULL DEFAULT 1 CHECK (copies >= 1),
  reading_status  text NOT NULL DEFAULT 'quero_ler'
                    CHECK (reading_status IN ('quero_ler','lendo','lido')),
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  finished_at     timestamptz,
  loaned_to       text,
  loaned_at       timestamptz,
  favorite        boolean NOT NULL DEFAULT false,
  started_at      timestamptz,
  page_count      integer CHECK (page_count IS NULL OR page_count > 0),
  current_page    integer CHECK (current_page IS NULL OR current_page >= 0),
  language        text,
  added_at        timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_operator_idx      ON public.books (operator_id);
CREATE INDEX IF NOT EXISTS books_isbn_idx           ON public.books (isbn);
CREATE INDEX IF NOT EXISTS books_reading_status_idx ON public.books (reading_status);
CREATE INDEX IF NOT EXISTS books_added_at_idx       ON public.books (added_at DESC);
CREATE INDEX IF NOT EXISTS books_genre_idx          ON public.books (genre);
CREATE INDEX IF NOT EXISTS books_loaned_to_idx      ON public.books (loaned_to);
CREATE INDEX IF NOT EXISTS books_favorite_idx       ON public.books (operator_id) WHERE favorite = true;

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

-- =========================================================
-- Meta de leitura anual: cada leitor define sua própria meta de
-- livros lidos por ano.
-- =========================================================
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

-- =========================================================
-- Métricas do dashboard: agregação feita no banco (SECURITY INVOKER,
-- respeita a RLS de public.books) em vez de full-table-fetch + reduce em JS.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_operator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH my_books AS (
    SELECT *
    FROM public.books
    WHERE operator_id = p_operator_id
  ),
  counts AS (
    SELECT
      count(*) FILTER (WHERE added_at >= date_trunc('day', now()))                                 AS today_count,
      count(*)                                                                                       AS total_books,
      COALESCE(sum(copies), 0)                                                                       AS total_copies,
      count(*) FILTER (WHERE reading_status = 'lido')                                                AS lido_count,
      count(*) FILTER (WHERE reading_status = 'lendo')                                                AS lendo_count,
      count(*) FILTER (WHERE reading_status = 'quero_ler')                                            AS quero_ler_count,
      count(*) FILTER (WHERE reading_status = 'lido' AND finished_at >= date_trunc('year', now()))    AS read_this_year,
      count(*) FILTER (WHERE reading_status = 'lido' AND rating IS NULL)                              AS unrated_read_count
    FROM my_books
  ),
  daily AS (
    SELECT date_trunc('day', added_at)::date AS day, count(*) AS c
    FROM my_books
    WHERE added_at >= now() - interval '30 days'
    GROUP BY 1
  ),
  recent AS (
    SELECT NULLIF(btrim(genre), '') AS genre, date_trunc('month', added_at)::date AS month
    FROM my_books
    WHERE added_at >= now() - interval '6 months'
  ),
  top_genres AS (
    SELECT genre, row_number() OVER (ORDER BY count(*) DESC) AS rn
    FROM recent
    WHERE genre IS NOT NULL
    GROUP BY genre
    ORDER BY count(*) DESC
    LIMIT 6
  ),
  months AS (
    SELECT gs::date AS month, row_number() OVER (ORDER BY gs) AS mn
    FROM generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS gs
  ),
  heatmap_cells AS (
    SELECT tg.rn AS genre_rn, tg.genre, m.mn AS month_n, count(r.genre) AS c
    FROM top_genres tg
    CROSS JOIN months m
    LEFT JOIN recent r ON r.genre = tg.genre AND r.month = m.month
    GROUP BY tg.rn, tg.genre, m.mn
  ),
  heatmap_rows AS (
    SELECT genre_rn, genre, jsonb_agg(c ORDER BY month_n) AS row_counts
    FROM heatmap_cells
    GROUP BY genre_rn, genre
  ),
  rating_dist AS (
    SELECT s.star, count(mb.id) AS c
    FROM generate_series(1, 5) AS s(star)
    LEFT JOIN my_books mb ON mb.reading_status = 'lido' AND mb.rating = s.star
    GROUP BY s.star
  ),
  genre_totals AS (
    SELECT COALESCE(NULLIF(btrim(genre), ''), 'Sem gênero') AS genre, count(*) AS c
    FROM my_books
    GROUP BY 1
  ),
  genre_ranked AS (
    SELECT genre, c, row_number() OVER (ORDER BY c DESC) AS rn
    FROM genre_totals
  ),
  genre_rows AS (
    SELECT genre, c FROM genre_ranked WHERE rn <= 6
    UNION ALL
    SELECT 'Outros', SUM(c) FROM genre_ranked WHERE rn > 6 HAVING SUM(c) > 0
  ),
  author_totals AS (
    SELECT btrim(author) AS author, count(*) AS c
    FROM my_books
    WHERE author IS NOT NULL AND btrim(author) <> ''
    GROUP BY 1
    ORDER BY c DESC
    LIMIT 10
  ),
  lido_genre AS (
    SELECT COALESCE(NULLIF(btrim(genre), ''), 'Sem gênero') AS genre, count(*) AS c
    FROM my_books
    WHERE reading_status = 'lido'
    GROUP BY 1
    ORDER BY c DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'todayCount', counts.today_count,
    'totalBooks', counts.total_books,
    'totalCopies', counts.total_copies,
    'lidoCount', counts.lido_count,
    'lendoCount', counts.lendo_count,
    'queroLerCount', counts.quero_ler_count,
    'readThisYear', counts.read_this_year,
    'unratedReadCount', counts.unrated_read_count,
    'dailyData', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', c) ORDER BY day) FROM daily),
      '[]'::jsonb
    ),
    'genreMonthHeatmap', jsonb_build_object(
      'genres', COALESCE((SELECT jsonb_agg(genre ORDER BY rn) FROM top_genres), '[]'::jsonb),
      'months', COALESCE((SELECT jsonb_agg(to_char(month, 'YYYY-MM') ORDER BY mn) FROM months), '[]'::jsonb),
      'matrix', COALESCE((SELECT jsonb_agg(row_counts ORDER BY genre_rn) FROM heatmap_rows), '[]'::jsonb)
    ),
    'ratingDistribution', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('star', star, 'count', c) ORDER BY star) FROM rating_dist),
      '[]'::jsonb
    ),
    'genreDonut', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', c)) FROM genre_rows),
      '[]'::jsonb
    ),
    'topAuthors', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('author', author, 'count', c)) FROM author_totals),
      '[]'::jsonb
    ),
    'topLidoGenre', (SELECT jsonb_build_object('genre', genre, 'count', c) FROM lido_genre)
  )
  FROM counts;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO authenticated;

-- =========================================================
-- Facetas de gênero: lista de gêneros do operador com contagem, usada para
-- popular os chips de filtro de gênero em /books.
-- =========================================================
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

-- =========================================================
-- Métricas detalhadas para /analytics (década, idioma, evolução da
-- coleção/leituras, páginas). Separada de get_dashboard_metrics de
-- propósito: o dashboard carrega a cada visita e não precisa desses dados.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_analytics_detail(p_operator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH my_books AS (
    SELECT *
    FROM public.books
    WHERE operator_id = p_operator_id
  ),
  decades AS (
    SELECT (published_year - published_year % 10) AS decade, count(*) AS c
    FROM my_books
    WHERE published_year IS NOT NULL
    GROUP BY 1
  ),
  languages AS (
    SELECT NULLIF(btrim(language), '') AS language, count(*) AS c
    FROM my_books
    WHERE NULLIF(btrim(language), '') IS NOT NULL
    GROUP BY 1
  ),
  bounds AS (
    SELECT date_trunc('month', COALESCE(min(added_at), now())) AS first_month
    FROM my_books
  ),
  months_series AS (
    SELECT gs::date AS month_start
    FROM bounds, generate_series(bounds.first_month, date_trunc('month', now()), interval '1 month') AS gs
  ),
  monthly_added AS (
    SELECT date_trunc('month', added_at)::date AS m, count(*) AS c
    FROM my_books
    GROUP BY 1
  ),
  growth AS (
    SELECT ms.month_start,
           SUM(COALESCE(ma.c, 0)) OVER (ORDER BY ms.month_start) AS cumulative
    FROM months_series ms
    LEFT JOIN monthly_added ma ON ma.m = ms.month_start
  ),
  monthly_finished AS (
    SELECT date_trunc('month', finished_at)::date AS m, count(*) AS c
    FROM my_books
    WHERE reading_status = 'lido' AND finished_at IS NOT NULL
    GROUP BY 1
  ),
  pages AS (
    SELECT
      COALESCE(sum(page_count) FILTER (WHERE reading_status = 'lido'), 0) AS total_pages,
      ROUND(AVG(page_count), 1) AS avg_pages
    FROM my_books
  ),
  top_authors_20 AS (
    SELECT btrim(author) AS author, count(*) AS c
    FROM my_books
    WHERE author IS NOT NULL AND btrim(author) <> ''
    GROUP BY 1
    ORDER BY c DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'decadeCounts', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('decade', decade, 'count', c) ORDER BY decade) FROM decades),
      '[]'::jsonb
    ),
    'languageCounts', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('language', language, 'count', c) ORDER BY c DESC) FROM languages),
      '[]'::jsonb
    ),
    'collectionGrowth', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', to_char(month_start, 'YYYY-MM'), 'count', cumulative) ORDER BY month_start) FROM growth),
      '[]'::jsonb
    ),
    'readingEvolution', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', to_char(m, 'YYYY-MM'), 'count', c) ORDER BY m) FROM monthly_finished),
      '[]'::jsonb
    ),
    'totalPagesRead', pages.total_pages,
    'avgPagesPerBook', pages.avg_pages,
    'topAuthors', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('author', author, 'count', c)) FROM top_authors_20),
      '[]'::jsonb
    )
  )
  FROM pages;
$$;

REVOKE ALL ON FUNCTION public.get_analytics_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analytics_detail(uuid) TO authenticated;
