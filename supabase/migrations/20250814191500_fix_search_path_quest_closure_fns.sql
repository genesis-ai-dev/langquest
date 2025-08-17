-- migration: set search_path and schema-qualify quest closure rebuild functions

set check_function_bodies = off;

create or replace function public.create_missing_quest_closures()
 returns table(quest_id uuid, project_id uuid, created boolean)
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[create_missing_quest_closures] Starting creation of missing quest_closure records';

    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id
    from public.quest q
    left join public.quest_closure qc on qc.quest_id = q.id
    where qc.quest_id is null
    on conflict (quest_id) do nothing;

    return query
    select q.id, q.project_id, (qc.quest_id is not null) as created
    from public.quest q
    left join public.quest_closure qc on qc.quest_id = q.id
    where qc.last_updated >= now() - interval '1 minute';

    raise notice '[create_missing_quest_closures] Completed creation of missing quest_closure records';
end;
$function$;

create or replace function public.rebuild_all_quest_closures()
 returns table(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    quest_record record;
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
    total_quests integer := 0;
    processed_quests integer := 0;
begin
    start_time := now();

    select count(*) into total_quests from public.quest where active = true;
    raise notice '[rebuild_all_quest_closures] Starting rebuild for % quests', total_quests;

    insert into public.quest_closure (quest_id, project_id)
    select q.id, q.project_id from public.quest q where q.active = true
    on conflict (quest_id) do nothing;

    for quest_record in 
        select q.id as quest_id, q.project_id 
        from public.quest q 
        where q.active = true
        order by q.created_at
    loop
        processed_quests := processed_quests + 1;

        update public.quest_closure 
        set 
            asset_ids = (
                select coalesce(jsonb_agg(distinct qal.asset_id), '[]'::jsonb)
                from public.quest_asset_link qal
                join public.asset a on a.id = qal.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
            ),
            translation_ids = (
                select coalesce(jsonb_agg(distinct t.id), '[]'::jsonb)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            vote_ids = (
                select coalesce(jsonb_agg(distinct v.id), '[]'::jsonb)
                from public.vote v
                join public.translation t on t.id = v.translation_id
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true and v.active = true
            ),
            tag_ids = (
                select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
                from (
                    select qtl.tag_id from public.quest_tag_link qtl
                    join public.tag tg on tg.id = qtl.tag_id
                    where qtl.quest_id = quest_record.quest_id and qtl.active = true and tg.active = true
                    union
                    select atl.tag_id from public.asset_tag_link atl
                    join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                    join public.tag tg on tg.id = atl.tag_id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and atl.active = true and tg.active = true
                ) all_tags
            ),
            language_ids = (
                select coalesce(jsonb_agg(distinct lang_id), '[]'::jsonb)
                from (
                    select a.source_language_id as lang_id from public.asset a
                    join public.quest_asset_link qal on qal.asset_id = a.id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
                    union
                    select t.target_language_id as lang_id from public.translation t
                    join public.quest_asset_link qal on qal.asset_id = t.asset_id
                    where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
                    union
                    select p.source_language_id as lang_id from public.project p
                    join public.quest q on q.project_id = p.id where q.id = quest_record.quest_id
                    union
                    select p.target_language_id as lang_id from public.project p
                    join public.quest q on q.project_id = p.id where q.id = quest_record.quest_id
                ) unique_languages
            ),
            quest_asset_link_ids = (
                select coalesce(jsonb_agg(distinct (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
                from public.quest_asset_link qal where qal.quest_id = quest_record.quest_id and qal.active = true
            ),
            asset_content_link_ids = (
                select coalesce(jsonb_agg(distinct acl.id), '[]'::jsonb)
                from public.asset_content_link acl
                join public.quest_asset_link qal on qal.asset_id = acl.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and acl.active = true
            ),
            quest_tag_link_ids = (
                select coalesce(jsonb_agg(distinct (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
                from public.quest_tag_link qtl where qtl.quest_id = quest_record.quest_id and qtl.active = true
            ),
            asset_tag_link_ids = (
                select coalesce(jsonb_agg(distinct (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
                from public.asset_tag_link atl
                join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and atl.active = true
            ),
            total_assets = (
                select count(distinct qal.asset_id)
                from public.quest_asset_link qal
                join public.asset a on a.id = qal.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and a.active = true
            ),
            total_translations = (
                select count(distinct t.id)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            approved_translations = (
                select count(distinct t.id)
                from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                join public.vote v on v.translation_id = t.id and v.polarity = 'up' and v.active = true
                where qal.quest_id = quest_record.quest_id and qal.active = true and t.active = true
            ),
            last_updated = now()
        where quest_id = quest_record.quest_id;
    end loop;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    return query
    select 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    from public.quest_closure qc
    join public.quest q on q.id = qc.quest_id
    where q.active = true
    order by qc.last_updated desc;
end;
$function$;

create or replace function public.rebuild_single_quest_closure(quest_id_param uuid)
 returns table(result_quest_id uuid, result_project_id uuid, result_total_assets integer, result_total_translations integer, result_approved_translations integer, result_processing_time_ms bigint)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
    start_time timestamp;
    end_time timestamp;
    processing_time_ms bigint;
    quest_project_id uuid;
begin
    start_time := now();
    select q.project_id into quest_project_id from public.quest q where q.id = quest_id_param and q.active = true;
    if quest_project_id is null then
        raise exception 'Quest not found or not active: %', quest_id_param;
    end if;

    insert into public.quest_closure (quest_id, project_id)
    values (quest_id_param, quest_project_id)
    on conflict (quest_id) do nothing;

    update public.quest_closure 
    set 
        asset_ids = (
            select coalesce(jsonb_agg(distinct qal.asset_id), '[]'::jsonb)
            from public.quest_asset_link qal
            join public.asset a on a.id = qal.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and a.active = true
        ),
        translation_ids = (
            select coalesce(jsonb_agg(distinct t.id), '[]'::jsonb)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        vote_ids = (
            select coalesce(jsonb_agg(distinct v.id), '[]'::jsonb)
            from public.vote v
            join public.translation t on t.id = v.translation_id
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true and v.active = true
        ),
        tag_ids = (
            select coalesce(jsonb_agg(distinct tag_id), '[]'::jsonb)
            from (
                select qtl.tag_id from public.quest_tag_link qtl
                join public.tag tg on tg.id = qtl.tag_id
                where qtl.quest_id = quest_id_param and qtl.active = true and tg.active = true
                union
                select atl.tag_id from public.asset_tag_link atl
                join public.quest_asset_link qal on qal.asset_id = atl.asset_id
                join public.tag tg on tg.id = atl.tag_id
                where qal.quest_id = quest_id_param and qal.active = true and atl.active = true
            ) all_tags
        ),
        language_ids = (
            select coalesce(jsonb_agg(distinct lang_id), '[]'::jsonb)
            from (
                select a.source_language_id as lang_id from public.asset a
                join public.quest_asset_link qal on qal.asset_id = a.id
                where qal.quest_id = quest_id_param and qal.active = true and a.active = true
                union
                select t.target_language_id as lang_id from public.translation t
                join public.quest_asset_link qal on qal.asset_id = t.asset_id
                where qal.quest_id = quest_id_param and qal.active = true and t.active = true
                union
                select p.source_language_id as lang_id from public.project p
                join public.quest q on q.project_id = p.id where q.id = quest_id_param
                union
                select p.target_language_id as lang_id from public.project p
                join public.quest q on q.project_id = p.id where q.id = quest_id_param
            ) unique_languages
        ),
        quest_asset_link_ids = (
            select coalesce(jsonb_agg(distinct (qal.quest_id || '-' || qal.asset_id)), '[]'::jsonb)
            from public.quest_asset_link qal where qal.quest_id = quest_id_param and qal.active = true
        ),
        asset_content_link_ids = (
            select coalesce(jsonb_agg(distinct acl.id), '[]'::jsonb)
            from public.asset_content_link acl
            join public.quest_asset_link qal on qal.asset_id = acl.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and acl.active = true
        ),
        quest_tag_link_ids = (
            select coalesce(jsonb_agg(distinct (qtl.quest_id || '-' || qtl.tag_id)), '[]'::jsonb)
            from public.quest_tag_link qtl where qtl.quest_id = quest_id_param and qtl.active = true
        ),
        asset_tag_link_ids = (
            select coalesce(jsonb_agg(distinct (atl.asset_id || '-' || atl.tag_id)), '[]'::jsonb)
            from public.asset_tag_link atl
            join public.quest_asset_link qal on qal.asset_id = atl.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and atl.active = true
        ),
        total_assets = (
            select count(distinct qal.asset_id)
            from public.quest_asset_link qal
            join public.asset a on a.id = qal.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and a.active = true
        ),
        total_translations = (
            select count(distinct t.id)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        approved_translations = (
            select count(distinct t.id)
            from public.translation t
            join public.quest_asset_link qal on qal.asset_id = t.asset_id
            join public.vote v on v.translation_id = t.id and v.polarity = 'up' and v.active = true
            where qal.quest_id = quest_id_param and qal.active = true and t.active = true
        ),
        last_updated = now()
    where quest_id = quest_id_param;

    end_time := now();
    processing_time_ms := extract(epoch from (end_time - start_time)) * 1000;

    return query
    select 
        qc.quest_id,
        qc.project_id,
        qc.total_assets,
        qc.total_translations,
        qc.approved_translations,
        processing_time_ms
    from public.quest_closure qc
    where qc.quest_id = quest_id_param;
end;
$function$;


