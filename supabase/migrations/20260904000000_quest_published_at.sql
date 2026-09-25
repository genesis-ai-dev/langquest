-- Unpublished quests live on the server but stay private to the creator.
-- published_at IS NULL = draft. Existing rows are backfilled to published.
-- New inserts stay unpublished unless the client stamps published_at.
-- Clients < 2.6 never uploaded drafts: v2_5_to_v2_6 stamps now() on PUT of a
-- new quest when the column is omitted. Clone inserts copy from the source.
--
-- After publish, quest and asset-related rows cannot be updated or deleted.
-- Asset DELETE previously had no policy, so undo uploads returned 2xx with
-- 0 rows deleted. Recordings store the storage object name in audio[]; the
-- file stays at local/ on disk until publish. Upload waits for published_at.

-- clone_id is used by perform_clone_step (source row id on the clone). It
-- exists in production but was never added in a committed migration, so
-- fresh/local databases fail clone RPCs. No-op when the column is already
-- present. Server-only: the client schema does not read or write it.
alter table public.project add column if not exists clone_id uuid;
alter table public.quest add column if not exists clone_id uuid;
alter table public.asset add column if not exists clone_id uuid;

-- Backfill only on the run that adds the column. Once published_at exists, a
-- null means "draft", so an unconditional backfill would publish every draft
-- if this migration were ever applied again.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quest'
      and column_name = 'published_at'
  ) then
    alter table public.quest add column published_at timestamptz;
    update public.quest set published_at = coalesce(created_at, now());
  end if;
end $$;

comment on column public.quest.published_at is
  'Null until the creator publishes. Omitted-column inserts stay unpublished. Clients < 2.6 get now() via v2_5_to_v2_6 on new quest PUTs.';

create index if not exists quest_published_at_idx
  on public.quest (published_at);

create index if not exists quest_creator_id_idx
  on public.quest (creator_id);

-- asset_is_readable() looks links up by asset_id; the primary key is
-- (quest_id, asset_id) and cannot serve that.
create index if not exists quest_asset_link_asset_id_idx
  on public.quest_asset_link (asset_id);

-- ---------------------------------------------------------------------------
-- Read-visibility helpers.
--
-- These must be security definer. Existing write policies on quest_asset_link,
-- asset_content_link and asset_tag_link read the asset table, so a read policy
-- on asset that inspected quest_asset_link inline would re-enter those tables'
-- policies and abort with 42P17 (infinite recursion). Running the traversal as
-- the owner skips policy expansion and breaks the cycle. They expose only a
-- boolean about a single id, and pin search_path so the referenced tables
-- cannot be shadowed.
-- ---------------------------------------------------------------------------

create or replace function public.quest_is_readable(p_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from quest q
    where q.id = p_quest_id
      and (
        q.published_at is not null
        or q.creator_id = (select auth.uid())
      )
  );
$$;

create or replace function public.asset_is_on_published_quest(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from quest_asset_link qal
    join quest q on q.id = qal.quest_id
    where qal.asset_id = p_asset_id
      and q.published_at is not null
  );
$$;

-- For rows that hang off an asset. Only ever called with an asset_id that is
-- already stored, so the creator lookup is safe here; the asset policy itself
-- must not look itself up (see below).
create or replace function public.asset_is_readable(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from asset a
    where a.id = p_asset_id
      and a.creator_id = (select auth.uid())
  ) or public.asset_is_on_published_quest(p_asset_id);
$$;

grant execute on function public.quest_is_readable(uuid) to anon, authenticated;
grant execute on function public.asset_is_on_published_quest(uuid) to anon, authenticated;
grant execute on function public.asset_is_readable(uuid) to anon, authenticated;

create or replace function public.quest_is_unpublished(p_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from quest q
    where q.id = p_quest_id
      and q.published_at is null
  );
$$;

comment on function public.quest_is_unpublished(uuid) is
  'True when the quest exists and published_at is null. Used by write RLS.';

grant execute on function public.quest_is_unpublished(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SELECT: published rows stay world-readable (previous policy). Drafts are
-- creator-only. showHiddenContent is a client visible-flag filter and must
-- not be able to read someone else's unpublished rows.
-- ---------------------------------------------------------------------------

drop policy if exists "Enable read access for all users" on public.quest;
drop policy if exists "Read published quests or own drafts" on public.quest;
create policy "Read published quests or own drafts"
on public.quest
as permissive
for select
to public
using (
  published_at is not null
  or creator_id = (select auth.uid())
);

drop policy if exists "Enable read access for all users" on public.quest_asset_link;
drop policy if exists "Read links for published quests or own drafts" on public.quest_asset_link;
create policy "Read links for published quests or own drafts"
on public.quest_asset_link
as permissive
for select
to public
using (public.quest_is_readable(quest_id));

drop policy if exists "Enable read access for all users" on public.quest_tag_link;
drop policy if exists "Read tags for published quests or own drafts" on public.quest_tag_link;
create policy "Read tags for published quests or own drafts"
on public.quest_tag_link
as permissive
for select
to public
using (public.quest_is_readable(quest_id));

-- Tests creator_id on the row itself rather than looking the asset up by id.
-- A put arrives as INSERT ... ON CONFLICT DO UPDATE, and Postgres applies the
-- select policy to the proposed row, which is not yet visible to a query
-- against the table; a lookup-based check would reject every new asset.
drop policy if exists "Enable read access for all users" on public.asset;
drop policy if exists "Read assets on published quests or own drafts" on public.asset;
create policy "Read assets on published quests or own drafts"
on public.asset
as permissive
for select
to public
using (
  creator_id = (select auth.uid())
  or public.asset_is_on_published_quest(id)
);

drop policy if exists "Enable read access for all users" on public.asset_content_link;
drop policy if exists "Read content for readable assets" on public.asset_content_link;
create policy "Read content for readable assets"
on public.asset_content_link
as permissive
for select
to public
using (public.asset_is_readable(asset_id));

drop policy if exists "Enable read access for all users" on public.asset_tag_link;
drop policy if exists "Read asset tags for readable assets" on public.asset_tag_link;
create policy "Read asset tags for readable assets"
on public.asset_tag_link
as permissive
for select
to public
using (public.asset_is_readable(asset_id));

drop policy if exists "Enable read access for all users" on public.vote;
drop policy if exists "Read votes for readable assets" on public.vote;
create policy "Read votes for readable assets"
on public.vote
as permissive
for select
to public
using (
  creator_id = (select auth.uid())
  or public.asset_is_readable(asset_id)
);

-- ---------------------------------------------------------------------------
-- UPDATE/DELETE: published quests cannot be mutated. Creators and owners can
-- still edit/delete drafts; owners can stamp published_at (publish). Drop the
-- older owner UPDATE policy that allowed mutating published rows.
-- ---------------------------------------------------------------------------

drop policy if exists "Enable quest updates only for project owners" on public.quest;

drop policy if exists "Creators can update unpublished quests" on public.quest;
create policy "Creators can update unpublished quests"
on public.quest
as permissive
for update
to authenticated
using (
  published_at is null
  and creator_id = (select auth.uid())
)
with check (
  creator_id = (select auth.uid())
);

drop policy if exists "Owners can publish unpublished quests" on public.quest;
create policy "Owners can publish unpublished quests"
on public.quest
as permissive
for update
to authenticated
using (
  published_at is null
  and exists (
    select 1 from profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = quest.project_id
      and ppl.membership = 'owner'
      and ppl.active = true
  )
)
with check (
  exists (
    select 1 from profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = quest.project_id
      and ppl.membership = 'owner'
      and ppl.active = true
  )
);

drop policy if exists "Quest delete limited to unpublished drafts" on public.quest;
create policy "Quest delete limited to unpublished drafts"
on public.quest
as permissive
for delete
to authenticated
using (
  published_at is null
  and (
    creator_id = (select auth.uid())
    or exists (
      select 1 from profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.project_id = quest.project_id
        and ppl.membership = 'owner'
        and ppl.active = true
    )
  )
);

-- asset / link UPDATE: keep existing membership gates, add unpublished.

drop policy if exists "Enable asset updates only by project owners" on public.asset;
create policy "Enable asset updates only by project owners"
on public.asset
as permissive
for update
to authenticated
using (
  not public.asset_is_on_published_quest(id)
  and exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = asset.project_id
      and ppl.membership = 'owner'
      and ppl.active = true
  )
)
with check (
  not public.asset_is_on_published_quest(id)
  and exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.project_id = asset.project_id
      and ppl.membership = 'owner'
      and ppl.active = true
  )
);

drop policy if exists "Enable updates only for project owners" on public.quest_asset_link;
create policy "Enable updates only for project owners"
on public.quest_asset_link
as permissive
for update
to authenticated
using (
  public.quest_is_unpublished(quest_id)
  and exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.membership = 'owner'
      and ppl.active = true
      and ppl.project_id = (
        select q.project_id from public.quest q where q.id = quest_asset_link.quest_id
      )
  )
)
with check (
  public.quest_is_unpublished(quest_id)
  and exists (
    select 1
    from public.profile_project_link ppl
    where ppl.profile_id = (select auth.uid())
      and ppl.membership = 'owner'
      and ppl.active = true
      and ppl.project_id = (
        select q.project_id from public.quest q where q.id = quest_asset_link.quest_id
      )
  )
);

drop policy if exists "Asset content update limited to owners and members"
  on public.asset_content_link;
create policy "Asset content update limited to owners and members"
on public.asset_content_link
as permissive
for update
to authenticated
using (
  not public.asset_is_on_published_quest(asset_id)
  and (
    exists (
      select 1
      from asset a
      join profile_project_link ppl on ppl.project_id = a.project_id
      where a.id = asset_content_link.asset_id
        and ppl.profile_id = (select auth.uid())
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or (
      exists (
        select 1
        from asset a
        join project p on p.id = a.project_id
        where a.id = asset_content_link.asset_id
          and p.creator_id = (select auth.uid())
      )
      and not exists (
        select 1
        from asset a
        join profile_project_link ppl2 on ppl2.project_id = a.project_id
        where a.id = asset_content_link.asset_id
          and ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
      )
    )
  )
)
with check (
  not public.asset_is_on_published_quest(asset_id)
  and (
    exists (
      select 1
      from asset a
      join profile_project_link ppl on ppl.project_id = a.project_id
      where a.id = asset_content_link.asset_id
        and ppl.profile_id = (select auth.uid())
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or (
      exists (
        select 1
        from asset a
        join project p on p.id = a.project_id
        where a.id = asset_content_link.asset_id
          and p.creator_id = (select auth.uid())
      )
      and not exists (
        select 1
        from asset a
        join profile_project_link ppl2 on ppl2.project_id = a.project_id
        where a.id = asset_content_link.asset_id
          and ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
      )
    )
  )
);

drop policy if exists "Quest tag link update limited to owners and members"
  on public.quest_tag_link;
create policy "Quest tag link update limited to owners and members"
on public.quest_tag_link
as permissive
for update
to authenticated
using (
  public.quest_is_unpublished(quest_id)
  and (
    exists (
      select 1
      from public.quest q
      join public.profile_project_link ppl on ppl.project_id = q.project_id
      where q.id = quest_tag_link.quest_id
        and ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
    )
    or (
      not exists (
        select 1
        from public.quest q
        join public.profile_project_link ppl2 on ppl2.project_id = q.project_id
        where q.id = quest_tag_link.quest_id
          and ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
      )
      and exists (
        select 1
        from public.quest q
        join public.project p on p.id = q.project_id
        where q.id = quest_tag_link.quest_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
)
with check (
  public.quest_is_unpublished(quest_id)
  and (
    exists (
      select 1
      from public.quest q
      join public.profile_project_link ppl on ppl.project_id = q.project_id
      where q.id = quest_tag_link.quest_id
        and ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
    )
    or (
      not exists (
        select 1
        from public.quest q
        join public.profile_project_link ppl2 on ppl2.project_id = q.project_id
        where q.id = quest_tag_link.quest_id
          and ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
      )
      and exists (
        select 1
        from public.quest q
        join public.project p on p.id = q.project_id
        where q.id = quest_tag_link.quest_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
);

-- DELETE: same collaborator gates as INSERT, plus unpublished.

drop policy if exists "Asset delete limited to owners and members" on public.asset;
create policy "Asset delete limited to owners and members"
on public.asset
as permissive
for delete
to authenticated
using (
  not public.asset_is_on_published_quest(id)
  and asset.creator_id = (select auth.uid())
  and (
    exists (
      select 1
      from profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
        and ppl.project_id = asset.project_id
    )
    or exists (
      select 1
      from project p
      where p.id = asset.project_id
        and p.creator_id = (select auth.uid())
    )
    or (
      asset.source_asset_id is not null
      and exists (
        select 1
        from project p
        where p.id = asset.project_id
          and p.private = false
      )
    )
  )
);

drop policy if exists "Quest asset link delete limited to owners and members"
  on public.quest_asset_link;
create policy "Quest asset link delete limited to owners and members"
on public.quest_asset_link
as permissive
for delete
to authenticated
using (
  public.quest_is_unpublished(quest_id)
  and (
    exists (
      select 1
      from quest q
      join profile_project_link ppl on ppl.project_id = q.project_id
      where q.id = quest_asset_link.quest_id
        and ppl.profile_id = (select auth.uid())
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or exists (
      select 1
      from quest q
      join project p on p.id = q.project_id
      where q.id = quest_asset_link.quest_id
        and p.creator_id = (select auth.uid())
    )
    or exists (
      select 1
      from quest q
      join project p on p.id = q.project_id
      join asset a on a.id = quest_asset_link.asset_id
      where q.id = quest_asset_link.quest_id
        and a.source_asset_id is not null
        and p.private = false
    )
  )
);

drop policy if exists "Asset content delete limited to owners and members"
  on public.asset_content_link;
create policy "Asset content delete limited to owners and members"
on public.asset_content_link
as permissive
for delete
to authenticated
using (
  not public.asset_is_on_published_quest(asset_id)
  and (
    exists (
      select 1
      from asset a
      join profile_project_link ppl on ppl.project_id = a.project_id
      where a.id = asset_content_link.asset_id
        and ppl.profile_id = (select auth.uid())
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or exists (
      select 1
      from asset a
      join project p on p.id = a.project_id
      where a.id = asset_content_link.asset_id
        and p.creator_id = (select auth.uid())
    )
    or exists (
      select 1
      from asset a
      join project p on p.id = a.project_id
      where a.id = asset_content_link.asset_id
        and a.source_asset_id is not null
        and p.private = false
    )
  )
);

drop policy if exists "Asset tag link delete limited to owners and members"
  on public.asset_tag_link;
create policy "Asset tag link delete limited to owners and members"
on public.asset_tag_link
as permissive
for delete
to authenticated
using (
  not public.asset_is_on_published_quest(asset_id)
  and (
    exists (
      select 1
      from public.profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
        and ppl.project_id = (
          select a.project_id from public.asset a where a.id = asset_tag_link.asset_id
        )
    )
    or (
      not exists (
        select 1
        from public.profile_project_link ppl2
        where ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
          and ppl2.project_id = (
            select a2.project_id from public.asset a2 where a2.id = asset_tag_link.asset_id
          )
      )
      and exists (
        select 1 from public.project p
        where p.id = (
          select a3.project_id from public.asset a3 where a3.id = asset_tag_link.asset_id
        )
          and p.creator_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists "Quest tag link delete limited to unpublished drafts"
  on public.quest_tag_link;
create policy "Quest tag link delete limited to unpublished drafts"
on public.quest_tag_link
as permissive
for delete
to authenticated
using (
  public.quest_is_unpublished(quest_id)
  and (
    exists (
      select 1
      from public.quest q
      join public.profile_project_link ppl on ppl.project_id = q.project_id
      where q.id = quest_tag_link.quest_id
        and ppl.profile_id = (select auth.uid())
        and ppl.active = true
        and ppl.membership in ('owner', 'member')
    )
    or (
      not exists (
        select 1
        from public.quest q
        join public.profile_project_link ppl2 on ppl2.project_id = q.project_id
        where q.id = quest_tag_link.quest_id
          and ppl2.profile_id = (select auth.uid())
          and ppl2.active = true
      )
      and exists (
        select 1
        from public.quest q
        join public.project p on p.id = q.project_id
        where q.id = quest_tag_link.quest_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
);

-- Votes stay mutable on published quests (users can retract a vote).
drop policy if exists "Enable vote delete only by vote creator" on public.vote;
create policy "Enable vote delete only by vote creator"
on public.vote
as permissive
for delete
to authenticated
using (creator_id = (select auth.uid()));

-- Clone inserts omit published_at. Copy the source quest's value so clones
-- keep the same published/draft state.
create or replace function public.quest_copy_published_at_from_clone_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clone_id is not null and new.published_at is null then
    select q.published_at
      into new.published_at
    from public.quest q
    where q.id = new.clone_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_quest_copy_published_at_from_clone on public.quest;
create trigger trigger_quest_copy_published_at_from_clone
  before insert on public.quest
  for each row
  execute function public.quest_copy_published_at_from_clone_source();

comment on function public.quest_copy_published_at_from_clone_source() is
  'On INSERT, if clone_id is set and published_at is omitted, copy published_at from the source quest.';

-- ---------------------------------------------------------------------------
-- Upload transform: pre-2.6 clients omit published_at. Stamp now() on PUT of
-- a new quest. Existing rows keep the key absent so ON CONFLICT does not
-- overwrite published_at.
--
-- Transform chain:
--   v0.x → v0_to_v1 → v1_to_v2 → v2_1_to_v2_2 → v2_3_to_v2_4 → v2_5_to_v2_6
--   v1.x → v1_to_v2 → v2_1_to_v2_2 → v2_3_to_v2_4 → v2_5_to_v2_6
--   v2.0/v2.1 → v2_1_to_v2_2 → v2_3_to_v2_4 → v2_5_to_v2_6
--   v2.2/v2.3 → v2_3_to_v2_4 → v2_5_to_v2_6
--   v2.4/v2.5 → v2_5_to_v2_6
--   v2.6+ → passthrough
-- ---------------------------------------------------------------------------

create or replace function public.v2_5_to_v2_6(
  p_ops public.mutation_op[],
  p_meta jsonb
)
returns public.mutation_op[]
language plpgsql
as $$
declare
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  v_meta text := coalesce(p_meta->>'schema_version', '');
  v_record jsonb;
  v_id uuid;
  v_exists boolean;
begin
  raise log '[v2_5_to_v2_6] start meta=% ops_count=%',
    v_meta,
    coalesce(array_length(p_ops, 1), 0);

  if p_ops is null then
    return '{}';
  end if;

  foreach op in array p_ops loop
    if lower(op.table_name) = 'quest' and lower(op.op) = 'put' then
      v_record := coalesce(op.record, '{}'::jsonb);

      if not (v_record ? 'published_at') then
        v_id := null;
        begin
          v_id := (v_record->>'id')::uuid;
        exception when others then
          v_id := null;
        end;

        v_exists := false;
        if v_id is not null then
          select exists(select 1 from public.quest q where q.id = v_id)
            into v_exists;
        end if;

        if not v_exists then
          v_record := v_record || jsonb_build_object('published_at', now());
          raise log '[v2_5_to_v2_6] quest put: stamped published_at for new id=%',
            v_id;
        end if;
      end if;

      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
    else
      out_ops := out_ops || op;
    end if;
  end loop;

  raise log '[v2_5_to_v2_6] end out_ops_count=%',
    coalesce(array_length(out_ops, 1), 0);

  return out_ops;
end;
$$;

comment on function public.v2_5_to_v2_6(public.mutation_op[], jsonb) is
  'Upload transform: for clients < 2.6, stamp quest.published_at = now() on PUT of a new quest when the column is omitted.';

create or replace function public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb,
  p_client_meta jsonb default '{}'::jsonb
)
returns text
language plpgsql
as $$
declare
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'schema_version', '0');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  v_version_is_v1 boolean := (v_meta = '1') or (v_meta like '1.%');
  v_version_is_pre_v2_2 boolean := (v_meta = '2') or (v_meta = '2.0') or (v_meta = '2.1');
  v_version_is_v2_2_or_v2_3 boolean := (v_meta = '2.2') or (v_meta = '2.3');
  v_version_is_pre_v2_6 boolean :=
    v_version_is_v0
    or v_version_is_v1
    or v_version_is_pre_v2_2
    or v_version_is_v2_2_or_v2_3
    or (v_meta = '2.4')
    or (v_meta = '2.5');
  ops public.mutation_op[] := array[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
begin
  if p_op is null or p_table_name is null then
    raise exception 'apply_table_mutation: op and table_name are required';
  end if;

  p_op := lower(p_op);

  raise log '[apply_table_mutation] input op=% table=% meta=% record=%',
    p_op, p_table_name, v_meta, p_record::text;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text);

  if v_version_is_v0 then
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  elsif v_version_is_v1 then
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  elsif v_version_is_pre_v2_2 then
    ops := public.v2_1_to_v2_2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_1_to_v2_2 applied\n';

    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';

  elsif v_version_is_v2_2_or_v2_3 then
    ops := public.v2_3_to_v2_4(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied\n';
  end if;

  if v_version_is_pre_v2_6 then
    ops := public.v2_5_to_v2_6(ops, p_client_meta);
    v_logs := v_logs || '[transform] v2_5_to_v2_6 applied\n';
  end if;

  final_ops := ops;

  for t, o, r in
    select (x).table_name, (x).op, (x).record
    from unnest(final_ops) as x
  loop
    raise log '[apply_table_mutation] executing op=% table=% record=%', o, t, r::text;
    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
    perform public._apply_single_json_dml(o, t, r);
  end loop;

  raise log '[apply_table_mutation] complete. aggregated logs=%', v_logs;

  return v_logs;
end;
$$;

-- Applied per inbound op so a 2.6 draft in the same batch as a legacy op is
-- not stamped published. v2_3_to_v2_4 still runs once on the full batch.
create or replace function public.apply_table_mutation_transaction(
  p_ops jsonb,
  p_default_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_logs text := '';
  inbound_ops jsonb[] := '{}';
  staged_ops public.mutation_op[] := '{}';
  final_ops public.mutation_op[] := '{}';
  t text; o text; r jsonb;
  v_sqlstate text;
  v_status text := '2xx';
  v_ref_code text := null;
  v_error_code text := null;
  v_error_message text := null;
  v_failed_op jsonb := null;
  v_meta text;
  elem jsonb;
  op_table text;
  op_name text;
  op_record jsonb;
  op_client_meta jsonb;
  v_op_count int := 0;
  v_version_is_v0 boolean;
  v_version_is_v1 boolean;
  v_version_is_pre_v2_2 boolean;
  v_version_is_v2_2_or_v2_3 boolean;
  v_version_is_pre_v2_4 boolean;
  v_version_is_pre_v2_6 boolean;
  v_any_pre_v2_4 boolean := false;
  v_transformed_ops public.mutation_op[];
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'apply_table_mutation_transaction: p_ops must be a json array';
  end if;

  for elem in select jsonb_array_elements(p_ops)
  loop
    inbound_ops := array_append(inbound_ops, elem);
  end loop;

  foreach elem in array inbound_ops
  loop
    op_table := coalesce(elem->>'table_name', elem->>'table');
    op_name := lower(coalesce(elem->>'op', ''));
    op_record := coalesce(elem->'record', '{}'::jsonb);
    op_client_meta := coalesce(elem->'client_meta', p_default_meta);
    v_meta := coalesce(op_client_meta->>'schema_version', '0');
    v_version_is_v0 := (v_meta = '0') or (v_meta like '0.%');
    v_version_is_v1 := (v_meta = '1') or (v_meta like '1.%');
    v_version_is_pre_v2_2 := (v_meta = '2') or (v_meta = '2.0') or (v_meta = '2.1');
    v_version_is_v2_2_or_v2_3 := (v_meta = '2.2') or (v_meta = '2.3');
    v_version_is_pre_v2_4 :=
      v_version_is_v0
      or v_version_is_v1
      or v_version_is_pre_v2_2
      or v_version_is_v2_2_or_v2_3;
    v_version_is_pre_v2_6 :=
      v_version_is_pre_v2_4
      or (v_meta = '2.4')
      or (v_meta = '2.5');

    if op_table is null or op_name = '' then
      raise exception 'apply_table_mutation_transaction: each elem requires table_name and op';
    end if;

    staged_ops := array[(row(op_table, op_name, op_record))::public.mutation_op];

    if v_version_is_v0 then
      v_transformed_ops := public.v0_to_v1(staged_ops, op_client_meta);
      v_transformed_ops := public.v1_to_v2(v_transformed_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v0_to_v1 + v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    elsif v_version_is_v1 then
      v_transformed_ops := public.v1_to_v2(staged_ops, op_client_meta);
      v_transformed_ops := public.v2_1_to_v2_2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v1_to_v2 + v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    elsif v_version_is_pre_v2_2 then
      v_transformed_ops := public.v2_1_to_v2_2(staged_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v2_1_to_v2_2 applied for %s %s\n',
        op_table, op_name
      );
    else
      v_transformed_ops := staged_ops;
    end if;

    if v_version_is_pre_v2_4 then
      v_any_pre_v2_4 := true;
    end if;

    if v_version_is_pre_v2_6 then
      v_transformed_ops := public.v2_5_to_v2_6(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format(
        '[transform] v2_5_to_v2_6 applied for %s %s\n',
        op_table, op_name
      );
    end if;

    final_ops := final_ops || v_transformed_ops;
  end loop;

  if v_any_pre_v2_4 then
    final_ops := public.v2_3_to_v2_4(final_ops, p_default_meta);
    v_logs := v_logs || '[transform] v2_3_to_v2_4 applied to batch\n';
  end if;

  v_op_count := array_length(final_ops, 1);
  v_logs := v_logs || format('[summary] total_ops=%s\n', coalesce(v_op_count, 0));

  begin
    for t, o, r in
      select (x::public.mutation_op).table_name,
             (x::public.mutation_op).op,
             (x::public.mutation_op).record
      from unnest(final_ops) as x
    loop
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      v_failed_op := jsonb_build_object('op', o, 'table', t, 'record', r);
      perform public._apply_single_json_dml(o, t, r);
      v_failed_op := null;
    end loop;
    v_status := '2xx';
  exception when others then
    get stacked diagnostics
      v_sqlstate = returned_sqlstate,
      v_error_message = message_text;
    v_error_code := v_sqlstate;

    if (v_sqlstate ~ '^22...$')
       or (v_sqlstate ~ '^23...$')
       or (v_sqlstate = '42501')
       or (v_sqlstate = '23505') then
      v_status := '4xx';
    else
      v_status := '5xx';
    end if;

    v_logs := v_logs || format(
      '[error] sqlstate=%s message=%s\n',
      v_sqlstate,
      coalesce(v_error_message, '')
    );

    if v_status = '4xx' then
      v_ref_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

      foreach elem in array inbound_ops
      loop
        insert into public.upload_inbox (data, logs, error_code, ref_code)
        values (elem, v_logs, v_error_code, v_ref_code);
      end loop;
    end if;
  end;

  return jsonb_build_object(
    'status', v_status,
    'logs', v_logs,
    'ref_code', v_ref_code,
    'error_code', v_error_code,
    'error_message', v_error_message,
    'failed_op', v_failed_op,
    'op_count', v_op_count,
    'ops_summary', (
      select jsonb_agg(
        jsonb_build_object(
          'table', op_elem->>'table_name',
          'op', op_elem->>'op',
          'has_record', (op_elem ? 'record')
        )
      )
      from jsonb_array_elements(p_ops) as op_elem
    )
  );
end;
$$;

-- Client 2.6 reads/writes published_at. Old apps (2.1+) still work: they
-- never upload drafts; v2_5_to_v2_6 stamps published_at on new quest PUTs.
create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.6',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Version 2.6 adds quest.published_at (unpublished drafts stay private to the creator).'
  );
$$;

-- Log how many rows each mutation actually touched. DELETE 0 under RLS looks
-- like success to the client today.
create or replace function public._apply_single_json_dml(
  p_op text,
  p_table text,
  p_record jsonb
)
returns void
language plpgsql
as $$
declare
  target regclass;
  primary_key_columns text[];
  all_table_columns text[];
  columns_to_update text[];
  where_primary_key_clause_sql text;
  update_set_assignments_sql text;
  dynamic_sql text;
  v_row_count int;
begin
  raise log '[._apply_single_json_dml] start op=% table=% record=%',
    p_op, p_table, p_record::text;

  select (quote_ident('public') || '.' || quote_ident(p_table))::regclass
    into target;

  select coalesce(array_agg(quote_ident(pg_attribute.attname) order by pg_attribute.attnum), '{}')
    into primary_key_columns
  from pg_index
  join pg_attribute
    on pg_attribute.attrelid = pg_index.indrelid
   and pg_attribute.attnum = any(pg_index.indkey)
  where pg_index.indrelid = target
    and pg_index.indisprimary;

  if array_length(primary_key_columns, 1) is null then
    raise exception 'apply_table_mutation: table % has no primary key; unsupported', p_table;
  end if;

  select array_agg(quote_ident(column_name) order by ordinal_position)
    into all_table_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table;

  select coalesce(array_agg(column_identifier), '{}')
    into columns_to_update
  from (
    select column_identifier
    from unnest(all_table_columns) as all_columns(column_identifier)
    where p_record ? replace(column_identifier, '"', '')
      and not (column_identifier = any(primary_key_columns))
  ) as selectable_columns;

  select string_agg(format('t.%s = input_values.%s', pk, pk), ' and ')
    into where_primary_key_clause_sql
  from unnest(primary_key_columns) as primary_key(pk);

  if lower(p_op) = 'put' then
    if array_length(columns_to_update, 1) is not null then
      select string_agg(format('%s = excluded.%s', column_identifier, column_identifier), ', ')
        into update_set_assignments_sql
      from unnest(columns_to_update) as update_columns(column_identifier);

      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do update set %s',
        target::text,
        target::text,
        array_to_string(primary_key_columns, ', '),
        update_set_assignments_sql
      );
    else
      dynamic_sql := format(
        'insert into %s select (jsonb_populate_record(null::%s, $1)).* on conflict (%s) do nothing',
        target::text,
        target::text,
        array_to_string(primary_key_columns, ', ')
      );
    end if;

    raise log '[._apply_single_json_dml] PUT upsert SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  elsif lower(p_op) in ('patch','update') then
    if array_length(columns_to_update, 1) is null then
      raise log '[._apply_single_json_dml] PATCH no non-PK cols present; skipping update';
      return;
    end if;

    select string_agg(format('%s = input_values.%s', column_identifier, column_identifier), ', ')
      into update_set_assignments_sql
    from unnest(columns_to_update) as update_columns(column_identifier);

    dynamic_sql := format(
      'update %s as t set %s from (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target::text,
      update_set_assignments_sql,
      target::text,
      where_primary_key_clause_sql
    );

    raise log '[._apply_single_json_dml] PATCH update SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  elsif lower(p_op) = 'delete' then
    dynamic_sql := format(
      'delete from %s as t using (select (jsonb_populate_record(null::%s, $1)).*) as input_values where %s',
      target::text,
      target::text,
      where_primary_key_clause_sql
    );

    raise log '[._apply_single_json_dml] DELETE SQL=%', dynamic_sql;
    execute dynamic_sql using p_record;

  else
    raise exception 'apply_table_mutation: unsupported op %', p_op;
  end if;

  get diagnostics v_row_count = row_count;
  raise log '[._apply_single_json_dml] row_count=% op=% table=%', v_row_count, p_op, p_table;
end;
$$;

