-- 005_add_dashboard_metrics_rpc.sql
-- Métricas agregadas do dashboard computadas em uma única função no banco,
-- substituindo o full-table-fetch + reduce em JS que rodava a cada carga da
-- página inicial. SECURITY INVOKER: roda com o papel do chamador, então a
-- RLS de public.books (operador só vê os próprios livros) continua valendo.
-- Rode este bloco no SQL Editor do Supabase (banco existente).
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
