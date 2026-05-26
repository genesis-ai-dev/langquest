-- Migration: create rpc_dashboard_chart_by_profile
-- Description:
-- Returns daily aggregates of quests/assets for projects where the profile is an active owner.

create or replace function public.rpc_dashboard_chart_by_profile(
  p_profile_id uuid,
  p_days integer default 45,
  p_project_id uuid default null
)
returns table (
  date date,
  quests integer,
  assets integer,
  quests_project jsonb,
  quests_member jsonb,
  assets_project jsonb,
  assets_member jsonb
)
language sql
stable
as $$
with params as (
  select greatest(1, coalesce(p_days, 45)) as days
),
owner_projects as (
  select distinct ppl.project_id
  from profile_project_link ppl
  where ppl.profile_id = p_profile_id
    and ppl.active = true
    and ppl.membership = 'owner'
    and (p_project_id is null or ppl.project_id = p_project_id)
),
cutoff as (
  select (current_date - ((select days from params) - 1) * interval '1 day')::timestamp as dt
),
quests_raw as (
  select
    q.project_id,
    q.creator_id,
    date(q.last_updated) as d
  from quest q
  join owner_projects op on op.project_id = q.project_id
  where q.active = true
    and q.last_updated >= (select dt from cutoff)
),
assets_raw as (
  select
    a.project_id,
    a.creator_id,
    date(a.last_updated) as d
  from asset a
  join owner_projects op on op.project_id = a.project_id
  where a.active = true
    and a.content_type = 'source'
    and a.last_updated >= (select dt from cutoff)
),
all_days as (
  select d from quests_raw
  union
  select d from assets_raw
)
select
  ad.d as date,
  coalesce((select count(*) from quests_raw q where q.d = ad.d), 0)::int as quests,
  coalesce((select count(*) from assets_raw a where a.d = ad.d), 0)::int as assets,

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.project_id,
        'name', coalesce(p.name, 'Unknown project'),
        'qty', t.qty
      )
      order by coalesce(p.name, 'Unknown project')
    )
    from (
      select q.project_id, count(*)::int as qty
      from quests_raw q
      where q.d = ad.d
      group by q.project_id
    ) t
    left join project p on p.id = t.project_id
  ), '[]'::jsonb) as quests_project,

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.member_id,
        'name', t.member_name,
        'qty', t.qty
      )
      order by t.member_name
    )
    from (
      select
        coalesce(q.creator_id::text, 'unknown-member') as member_id,
        coalesce(
          pr.username,
          case
            when q.creator_id is null then 'Unknown member'
            else 'Member ' || left(q.creator_id::text, 8)
          end
        ) as member_name,
        count(*)::int as qty
      from quests_raw q
      left join profile pr on pr.id = q.creator_id
      where q.d = ad.d
      group by q.creator_id, pr.username
    ) t
  ), '[]'::jsonb) as quests_member,

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.project_id,
        'name', coalesce(p.name, 'Unknown project'),
        'qty', t.qty
      )
      order by coalesce(p.name, 'Unknown project')
    )
    from (
      select a.project_id, count(*)::int as qty
      from assets_raw a
      where a.d = ad.d
      group by a.project_id
    ) t
    left join project p on p.id = t.project_id
  ), '[]'::jsonb) as assets_project,

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.member_id,
        'name', t.member_name,
        'qty', t.qty
      )
      order by t.member_name
    )
    from (
      select
        coalesce(a.creator_id::text, 'unknown-member') as member_id,
        coalesce(
          pr.username,
          case
            when a.creator_id is null then 'Unknown member'
            else 'Member ' || left(a.creator_id::text, 8)
          end
        ) as member_name,
        count(*)::int as qty
      from assets_raw a
      left join profile pr on pr.id = a.creator_id
      where a.d = ad.d
      group by a.creator_id, pr.username
    ) t
  ), '[]'::jsonb) as assets_member

from all_days ad
order by ad.d;
$$;