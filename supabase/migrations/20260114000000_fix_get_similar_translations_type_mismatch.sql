-- Migration: Fix type mismatch in get_similar_translations RPC
-- Problem: ts_rank() returns 'real' but function declares 'float' (double precision) return type
-- Fix: Cast ts_rank() result to double precision

set check_function_bodies = off;
set search_path = public;

create or replace function public.get_similar_translations(
  p_project_id uuid,
  p_target_language_id uuid,
  p_source_text text,
  p_match_threshold float default 0.1,
  p_limit int default 30
)
returns table (
  source_text text,
  target_text text,
  similarity_score float
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with source_candidates as (
    -- Find source assets in the project that match the query text
    -- Uses the GIN index on text_search_vector for speed
    select
      a.id as asset_id,
      acl.text as source_text,
      ts_rank(acl.text_search_vector, websearch_to_tsquery('simple', p_source_text))::double precision as rank
    from public.asset a
    join public.asset_content_link acl on acl.asset_id = a.id
    where a.project_id = p_project_id
      and a.source_asset_id is null -- Only original assets
      and a.active = true
      and acl.text is not null
      -- Only consider assets with some relevance (websearch allows OR/phrase matching)
      and acl.text_search_vector @@ websearch_to_tsquery('simple', p_source_text)
  ),
  ranked_candidates as (
    -- Filter by rank threshold
    select * from source_candidates
    where rank >= p_match_threshold
    order by rank desc
    limit p_limit * 2 -- Get a pool of candidates to find translations for
  ),
  best_translations as (
    -- Find the best translation for each candidate
    select distinct on (rc.asset_id)
      rc.source_text,
      t_acl.text as target_text,
      rc.rank as similarity_score,
      -- Scoring logic for translations: upvotes > recent
      coalesce(sum(case when v.polarity = 'up' and v.active = true then 1 else 0 end), 0) as upvotes
    from ranked_candidates rc
    join public.asset t on t.source_asset_id = rc.asset_id
    join public.asset_content_link t_acl on t_acl.asset_id = t.id
    left join public.vote v on v.asset_id = t.id
    where t.source_language_id = p_target_language_id
      and t.active = true
      and t_acl.text is not null
    group by rc.asset_id, rc.source_text, rc.rank, t.id, t_acl.text, t.created_at
    order by rc.asset_id, upvotes desc, t.created_at desc
  )
  select
    bt.source_text,
    bt.target_text,
    bt.similarity_score
  from best_translations bt
  order by bt.similarity_score desc
  limit p_limit;
end;
$$;
