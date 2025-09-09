-- Minimal migration: ensure batched quest-closure recompute includes zeroed rows with real links
-- Rationale: avoid skipping "shell" quest_closure rows created during clone; keep batching to prevent timeouts

create or replace function public.rebuild_project_quest_closures_batch(
  p_project_id uuid,
  p_since timestamptz,
  p_limit int default 50
)
returns int
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int := 0;
  v_qid uuid;
begin
  for v_qid in (
    select q.id
    from public.quest q
    left join public.quest_closure qc on qc.quest_id = q.id
    where q.project_id = p_project_id
      and (
        qc.quest_id is null
        or qc.last_updated is null
        or qc.last_updated < p_since
        or (
          coalesce(qc.total_assets, 0) = 0
          and exists (
            select 1 from public.quest_asset_link qal
            where qal.quest_id = q.id and qal.active = true
          )
        )
      )
    order by q.created_at
    limit greatest(coalesce(p_limit, 50), 1)
  ) loop
    perform public.rebuild_single_quest_closure(v_qid);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;


