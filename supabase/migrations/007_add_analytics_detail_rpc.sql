-- 007_add_analytics_detail_rpc.sql
-- Métricas detalhadas para a página /analytics (década, idioma, evolução da
-- coleção/leituras, páginas). Separada de get_dashboard_metrics de propósito:
-- o dashboard carrega a cada visita e não precisa desses dados extras.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
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
