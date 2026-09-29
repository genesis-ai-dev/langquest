-- Display names for published-quest creators.
-- Profile SELECT is co-member-only, so non-members browsing a public project
-- cannot read username and the version picker falls back to "Unknown".
-- Email stays off this surface; only id + username are returned.

create or replace function public.get_profile_display_names(p_ids uuid[])
returns table (id uuid, username text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username
  from public.profile p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]))
    and (
      p.id = (select auth.uid())
      or exists (
        select 1
        from public.quest q
        where q.creator_id = p.id
          and q.published_at is not null
      )
    );
$$;

comment on function public.get_profile_display_names(uuid[]) is
  'Returns id and username for the caller and for creators of published quests. Does not expose email.';

revoke all on function public.get_profile_display_names(uuid[]) from public;
grant execute on function public.get_profile_display_names(uuid[]) to anon, authenticated;
