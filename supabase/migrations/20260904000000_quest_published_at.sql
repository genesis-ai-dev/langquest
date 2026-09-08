-- Unpublished quests live on the server but stay private to the creator.
-- published_at IS NULL = draft. Existing rows are backfilled to published.
-- New inserts stay unpublished unless the client stamps published_at.
-- Clients < 2.6 never uploaded drafts: v2_5_to_v2_6 stamps now() on PUT of a
-- new quest when the column is omitted. Clone inserts copy from the source.

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
-- UPDATE: drafts are editable by the creator. Published quests keep the
-- existing owner policy. Owners may also stamp published_at (publish).
-- ---------------------------------------------------------------------------

drop policy if exists "Enable quest updates only for project owners" on public.quest;
create policy "Enable quest updates only for project owners"
on public.quest
as permissive
for update
to authenticated
using (
  published_at is not null
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

