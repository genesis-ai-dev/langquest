-- Minimal hardening: make project-level closure rollup resilient to timeouts
-- Rationale: if the project rollup times out, do not abort the clone step; let the caller mark job done

set check_function_bodies = off;

create or replace function public.rebuild_single_project_closure(project_id_param uuid)
 returns table(result_project_id uuid, result_total_quests integer, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
begin
    start_time := now();

    -- Ensure row exists
    insert into public.project_closure (project_id)
    values (project_id_param)
    on conflict (project_id) do nothing;

    -- Best-effort rollup; swallow statement timeout to avoid aborting caller
    begin
      update public.project_closure 
      set 
          quest_ids = (
              select coalesce(jsonb_agg(distinct qc.quest_id), '[]'::jsonb)
              from public.quest_closure qc
              join public.quest q on q.id = qc.quest_id
              where qc.project_id = project_id_param and q.active = true
          ),
          asset_ids = (
              select coalesce(jsonb_agg(distinct asset_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.asset_ids)::uuid as asset_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_assets
          ),
          translation_ids = (
              select coalesce(jsonb_agg(distinct translation_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.translation_ids)::uuid as translation_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_translations
          ),
          vote_ids = (
              select coalesce(jsonb_agg(distinct vote_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.vote_ids)::uuid as vote_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_votes
          ),
          tag_ids = (
              select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.tag_ids)::uuid as tag_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_tags
          ),
          language_ids = (
              select coalesce(jsonb_agg(distinct language_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.language_ids)::uuid as language_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_languages
          ),
          quest_asset_link_ids = (
              select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.quest_asset_link_ids) as link_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_quest_asset_links
          ),
          asset_content_link_ids = (
              select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.asset_content_link_ids)::uuid as link_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_asset_content_links
          ),
          quest_tag_link_ids = (
              select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.quest_tag_link_ids) as link_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_quest_tag_links
          ),
          asset_tag_link_ids = (
              select coalesce(jsonb_agg(distinct link_id), '[]'::jsonb)
              from (
                  select jsonb_array_elements_text(qc.asset_tag_link_ids) as link_id
                  from public.quest_closure qc
                  join public.quest q on q.id = qc.quest_id
                  where qc.project_id = project_id_param and q.active = true
              ) aggregated_asset_tag_links
          ),
          total_quests = (
              select count(distinct qc.quest_id)
              from public.quest_closure qc
              join public.quest q on q.id = qc.quest_id
              where qc.project_id = project_id_param and q.active = true
          ),
          total_assets = (
              select coalesce(sum(qc.total_assets), 0)
              from public.quest_closure qc
              join public.quest q on q.id = qc.quest_id
              where qc.project_id = project_id_param and q.active = true
          ),
          total_translations = (
              select coalesce(sum(qc.total_translations), 0)
              from public.quest_closure qc
              join public.quest q on q.id = qc.quest_id
              where qc.project_id = project_id_param and q.active = true
          ),
          approved_translations = (
              select coalesce(sum(qc.approved_translations), 0)
              from public.quest_closure qc
              join public.quest q on q.id = qc.quest_id
              where qc.project_id = project_id_param and q.active = true
          ),
          last_updated = now()
      where project_id = project_id_param;
    exception when query_canceled then
      -- Statement timed out; leave existing values as-is and let caller proceed
      raise notice '[rebuild_single_project_closure] timeout for project_id: % (best-effort applied)', project_id_param;
    when others then
      -- Any other error: do not abort caller; log and continue
      raise notice '[rebuild_single_project_closure] error for project_id: % -> %', project_id_param, sqlerrm;
    end;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    return query
    select 
        pc.project_id,
        pc.total_quests,
        pc.total_assets,
        pc.total_translations,
        pc.approved_translations,
        processing_time_ms
    from public.project_closure pc
    where pc.project_id = project_id_param;
end;
$function$;



