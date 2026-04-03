
CREATE OR REPLACE FUNCTION public.get_group_stats(_oil_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- Verify caller has access to this oil
  IF NOT has_oil_access(auth.uid(), _oil_id) THEN
    RETURN json_build_object('error', 'no_access');
  END IF;

  SELECT json_build_object(
    'total_entries', (SELECT count(*) FROM entries WHERE oil_id = _oil_id),
    'unique_users', (SELECT count(DISTINCT user_id) FROM entries WHERE oil_id = _oil_id),
    'mood_counts', COALESCE((
      SELECT json_object_agg(mood, cnt)
      FROM (
        SELECT mood, count(*) as cnt
        FROM entries
        WHERE oil_id = _oil_id AND mood IS NOT NULL
        GROUP BY mood
        ORDER BY cnt DESC
      ) sub
    ), '{}'::json),
    'recent_days', COALESCE((
      SELECT json_agg(json_build_object('date', d, 'count', c))
      FROM (
        SELECT date as d, count(*) as c
        FROM entries
        WHERE oil_id = _oil_id AND date >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY date
        ORDER BY date
      ) sub
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
