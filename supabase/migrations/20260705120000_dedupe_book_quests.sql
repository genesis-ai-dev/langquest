-- ============================================================================
-- Migration: Deduplicate Bible book quests
-- ============================================================================
--
-- PURPOSE:
-- The app's find-or-create for book quests (hooks/useBibleBookCreation.ts) can
-- race offline: two devices (or one offline device plus the cloud) each create
-- a book quest for the same project + book. Chapters then get split across the
-- duplicate parents, and navigation lands users on the copy without their work.
--
-- APPROACH ("tombstones", never delete):
-- 1. New column quest.duplicate_of (self-FK). A book quest with duplicate_of
--    set is a tombstone: active=false, download_profiles=NULL. NULL
--    download_profiles removes it from every PowerSync bucket (sync rules
--    filter on download_profiles only), so devices drop it — but the row
--    survives so offline clients can still upload children referencing it.
-- 2. BEFORE INSERT trigger: an incoming duplicate book quest is tombstoned on
--    arrival; an incoming chapter whose parent is a tombstone is re-pointed to
--    the surviving book.
-- 3. BEFORE UPDATE trigger guard: tombstones stay tombstoned. This covers
--    (a) PUT retries — apply_table_mutation applies 'put' as
--        INSERT ... ON CONFLICT DO UPDATE, and PowerSync delivers ops
--        at-least-once (a lost ack redelivers the same op), which would
--        otherwise restore active/download_profiles from the client's stale
--        record, and
--    (b) download_quest_closure / download_project_closure, which bulk-append
--        profile ids to quest.download_profiles and would otherwise re-sync
--        tombstones to devices. The guard makes those functions' writes to
--        tombstones no-ops, so they don't need to be modified.
-- 4. One-time merge of existing duplicates via dedupe_book_quests(p_apply):
--    survivor = most children (tie: oldest). Losers' chapters are reparented
--    to the survivor (they become additional versions of those chapters,
--    which the app supports), losers' download_profiles are unioned into the
--    survivor, losers are tombstoned.
--
--    REPORTING: the same function is the preview. Run
--        select * from public.dedupe_book_quests(false);
--    for a read-only, line-for-line preview of exactly what an apply would
--    do. The migration itself runs it with p_apply => true and records every
--    change in public.migration_backfill_log (a general-purpose audit table
--    for backfill migrations, introduced here), so what actually changed is
--    queryable afterwards:
--        select * from public.migration_backfill_log
--        where migration = '20260705120000_dedupe_book_quests' order by id;
--
-- Server-only change (Path A): nothing here is read or written by the client.
-- NO APP_SCHEMA_VERSION / get_schema_info() bump.
--
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1. Add quest.duplicate_of
-- ============================================================================

alter table public.quest
  add column if not exists duplicate_of uuid references public.quest (id);

comment on column public.quest.duplicate_of is
  'Set when this quest was detected as a duplicate book quest. Points to the surviving book quest. Rows with this set are tombstones: active=false, download_profiles=NULL (synced to nobody), kept so offline clients uploading children of this quest can be redirected to the survivor. Server-only; clients ignore it.';

-- ============================================================================
-- 2. Trigger: tombstone incoming duplicates, redirect their children,
--    and keep existing tombstones tombstoned
-- ============================================================================

create or replace function public.handle_duplicate_book_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger_fn$
declare
  v_meta jsonb;
  v_book text;
  v_survivor uuid;
  v_parent_dup uuid;
  v_hops integer := 0;
begin
  -- (a) Tombstones stay tombstoned. Covers PUT-retry upserts (which replay the
  -- client's stale active/download_profiles) and the closure download
  -- functions (which append profile ids to download_profiles in bulk).
  if tg_op = 'UPDATE' and old.duplicate_of is not null then
    new.duplicate_of := old.duplicate_of;
    new.active := false;
    new.download_profiles := null;
    -- Keep the corrected hierarchy too (a stale PUT carries the old values).
    new.parent_id := old.parent_id;
    return new;
  end if;

  -- (b) Child quest pointing at a tombstoned parent: re-point to the survivor.
  -- Loop defensively in case tombstones ever chain.
  if new.parent_id is not null then
    loop
      select q.duplicate_of into v_parent_dup
      from public.quest q
      where q.id = new.parent_id;

      exit when v_parent_dup is null or v_hops >= 5;

      new.parent_id := v_parent_dup;
      v_hops := v_hops + 1;
    end loop;
    return new;
  end if;

  -- (c) Incoming top-level Bible book quest: if a live copy of the same book
  -- already exists in this project, tombstone the incoming one.
  if tg_op = 'INSERT' and new.metadata is not null then
    v_meta := new.metadata::jsonb;
    if jsonb_typeof(v_meta) = 'string' then
      -- metadata is sometimes double-encoded JSON
      v_meta := (v_meta #>> '{}')::jsonb;
    end if;

    v_book := lower(v_meta #>> '{bible,book}');

    if v_book is not null and v_meta #> '{bible,chapter}' is null then
      select q.id into v_survivor
      from public.quest q
      where q.project_id = new.project_id
        and q.parent_id is null
        and q.duplicate_of is null
        and q.active = true
        and q.id <> new.id
        and q.metadata is not null
        and lower(
          case
            when jsonb_typeof(q.metadata::jsonb) = 'string'
              then ((q.metadata::jsonb #>> '{}')::jsonb #>> '{bible,book}')
            else (q.metadata::jsonb #>> '{bible,book}')
          end
        ) = v_book
        and (
          case
            when jsonb_typeof(q.metadata::jsonb) = 'string'
              then ((q.metadata::jsonb #>> '{}')::jsonb #> '{bible,chapter}')
            else (q.metadata::jsonb #> '{bible,chapter}')
          end
        ) is null
      order by q.created_at asc
      limit 1;

      if v_survivor is not null then
        raise log '[handle_duplicate_book_quests] Tombstoning duplicate book quest % (project=%, book=%) -> survivor %',
          new.id, new.project_id, v_book, v_survivor;
        new.duplicate_of := v_survivor;
        new.active := false;
        new.download_profiles := null;
      end if;
    end if;
  end if;

  return new;
exception
  when others then
    -- Never block an upload over dedup bookkeeping: a thrown error here would
    -- make the client discard its whole upload transaction (see
    -- FATAL_RESPONSE_CODES handling in SupabaseConnector.ts).
    raise log '[handle_duplicate_book_quests] Swallowed error: % (op=%, quest=%)',
      sqlerrm, tg_op, new.id;
    return new;
end;
$trigger_fn$;

drop trigger if exists trg_handle_duplicate_book_quests on public.quest;

create trigger trg_handle_duplicate_book_quests
  before insert or update on public.quest
  for each row
  execute function public.handle_duplicate_book_quests();

-- ============================================================================
-- 3. General-purpose backfill audit log (reusable by future migrations)
-- ============================================================================

-- General-purpose audit table: any backfill migration that mutates existing
-- records should insert one row per changed record here, so "what did that
-- migration actually change?" stays answerable long after the fact.
create table if not exists public.migration_backfill_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  migration text not null,   -- migration filename (without .sql)
  table_name text not null,  -- table whose record was changed
  record_id text not null,   -- id of the changed record (text to support composite keys)
  action text not null,      -- migration-specific, e.g. 'tombstone_book'
  details jsonb not null     -- before/after values and any extra context
);

comment on table public.migration_backfill_log is
  'Record-level audit of data changes made by backfill migrations. One row per changed record. Server-only; not synced to clients.';

create index if not exists migration_backfill_log_migration_idx
  on public.migration_backfill_log (migration);

-- Server-only table: no client/API access.
alter table public.migration_backfill_log enable row level security;

-- ============================================================================
-- 4. Merge function — the single source of truth for the backfill logic.
--    p_apply = false: read-only preview of exactly what an apply would do.
--    p_apply = true : performs the changes and returns the same report.
-- ============================================================================

create or replace function public.dedupe_book_quests(p_apply boolean default false)
returns table (
  action text,
  project_id uuid,
  project_name text,
  book_code text,
  quest_id uuid,
  quest_name text,
  details jsonb
)
language plpgsql
security definer
set search_path = public
as $dedupe_fn$
declare
  grp record;
  v_losers uuid[];
  v_profiles uuid[];
  v_survivor_profiles uuid[];
begin
  for grp in (
    with normalized as (
      select q.*,
             case
               when jsonb_typeof(q.metadata::jsonb) = 'string'
                 then (q.metadata::jsonb #>> '{}')::jsonb
               else q.metadata::jsonb
             end as meta
      from quest q
      where q.parent_id is null
        and q.metadata is not null
        and q.duplicate_of is null
    ),
    book_quests as (
      select n.*, lower(n.meta #>> '{bible,book}') as bcode
      from normalized n
      where n.meta #>> '{bible,book}' is not null
        and n.meta #> '{bible,chapter}' is null
    ),
    counted as (
      select b.*,
             (select count(*) from quest c where c.parent_id = b.id) as child_count
      from book_quests b
    ),
    ranked as (
      select c.*,
             count(*)     over (partition by c.project_id, c.bcode) as copies,
             row_number() over (partition by c.project_id, c.bcode
                                order by c.child_count desc, c.created_at asc, c.id) as rn
      from counted c
    )
    select r.project_id as grp_project_id,
           r.bcode      as grp_book_code,
           (array_agg(r.id order by r.rn))[1] as survivor_id,
           array_agg(r.id order by r.rn)      as all_ids
    from ranked r
    where r.copies > 1
    group by r.project_id, r.bcode
  ) loop
    v_losers := array_remove(grp.all_ids, grp.survivor_id);

    -- Union of download_profiles across the whole group.
    select array_agg(distinct dp)
      into v_profiles
    from quest q
    cross join lateral unnest(coalesce(q.download_profiles, '{}')) as dp
    where q.id = any (grp.all_ids);

    select q.download_profiles
      into v_survivor_profiles
    from quest q
    where q.id = grp.survivor_id;

    -- Report: survivor keeps everything and inherits the unioned profiles.
    return query
    select 'survivor_profiles'::text,
           grp.grp_project_id,
           p.name,
           grp.grp_book_code,
           q.id,
           q.name,
           jsonb_build_object(
             'download_profiles_before', to_jsonb(v_survivor_profiles),
             'download_profiles_after',  to_jsonb(v_profiles)
           )
    from quest q
    join project p on p.id = q.project_id
    where q.id = grp.survivor_id;

    -- Report: losers get tombstoned.
    return query
    select 'tombstone_book'::text,
           grp.grp_project_id,
           p.name,
           grp.grp_book_code,
           q.id,
           q.name,
           jsonb_build_object(
             'active_before',            q.active,
             'active_after',             false,
             'download_profiles_before', to_jsonb(q.download_profiles),
             'download_profiles_after',  null,
             'duplicate_of_after',       grp.survivor_id::text
           )
    from quest q
    join project p on p.id = q.project_id
    where q.id = any (v_losers);

    -- Report: losers' chapters get reparented to the survivor.
    return query
    select 'reparent_chapter'::text,
           grp.grp_project_id,
           p.name,
           grp.grp_book_code,
           c.id,
           c.name,
           jsonb_build_object(
             'parent_id_before', c.parent_id::text,
             'parent_id_after',  grp.survivor_id::text
           )
    from quest c
    join project p on p.id = c.project_id
    where c.parent_id = any (v_losers);

    if p_apply then
      if v_profiles is not null then
        update quest q
        set download_profiles = v_profiles
        where q.id = grp.survivor_id;
      end if;

      update quest q
      set parent_id = grp.survivor_id
      where q.parent_id = any (v_losers);

      update quest q
      set active = false,
          download_profiles = null,
          duplicate_of = grp.survivor_id
      where q.id = any (v_losers);
    end if;
  end loop;

  return;
end;
$dedupe_fn$;

-- Not callable through the API; run it from the SQL editor / migrations only.
revoke execute on function public.dedupe_book_quests(boolean) from public, anon, authenticated;

-- ============================================================================
-- 5. One-time merge of existing duplicates, persisted to the audit log
-- ============================================================================

insert into public.migration_backfill_log (migration, table_name, record_id, action, details)
select '20260705120000_dedupe_book_quests',
       'quest',
       r.quest_id::text,
       r.action,
       r.details || jsonb_build_object(
         'project_id',   r.project_id::text,
         'project_name', r.project_name,
         'book_code',    r.book_code,
         'quest_name',   r.quest_name
       )
from public.dedupe_book_quests(p_apply => true) as r;
