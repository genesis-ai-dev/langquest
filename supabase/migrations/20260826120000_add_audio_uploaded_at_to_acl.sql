-- ============================================================================
-- Migration: Add audio_uploaded_at to asset_content_link
-- Version: 2.4 → 2.5 (minor bump — additive, nullable, client reads it)
-- ============================================================================
--
-- PURPOSE:
-- Track when the audio object(s) referenced by an asset_content_link row were
-- actually confirmed uploaded to Supabase Storage. This complements uploaded_at
-- (which tracks when the DB row itself was persisted server-side) so the client
-- can show real upload progress instead of assuming success at queue time.
--
-- The value carries storage.objects.created_at for the matching object(s).
--
-- WHY TWO TRIGGERS:
--   Audio files are uploaded at record time, but the asset_content_link row is
--   only pushed to the server later, at publish. So the ordering is unknown:
--     - Normal flow (record → publish): the storage object already exists when
--       the acl row arrives → the acl-side BEFORE INSERT trigger stamps it.
--     - Late upload: the acl row already exists when the object arrives → the
--       storage.objects AFTER INSERT trigger stamps it.
--   The one-time backfill below covers rows that predate this migration.
--
-- NOT HANDLED — audio changed on an existing row (re-record in place):
--   If acl.audio is ever UPDATEd to reference new object names, the stale
--   audio_uploaded_at survives (no UPDATE OF audio trigger clears it), and the
--   storage trigger's "audio_uploaded_at is null" guard will skip the row when
--   the new object arrives. Today the app never updates audio on an existing
--   acl row — every recording creates a new asset + acl row — so this path
--   cannot occur. If re-record-in-place is ever added, add a BEFORE UPDATE OF
--   audio trigger that resets audio_uploaded_at to null when the array changes.
--
-- MATCHING:
--   acl.audio is a jsonb array of object names (e.g. '["<uuid>.wav"]'). App
--   uploads land at the bucket root, so storage.objects.name equals the array
--   element. Matched via the jsonb "?" (contains-element) operator / array
--   expansion, backed by a GIN index on acl.audio. Names are UUID-based, so
--   matching by name (not bucket) is safe. A row is only stamped once EVERY
--   element in audio[] has a matching storage object, using the newest
--   object's created_at.
--
-- CLIENT:
--   Nullable, server-populated only. The Drizzle schema adds audio_uploaded_at
--   as text() for typing; PowerSync syncs the value down on UPDATE. No local
--   SQLite migration is needed (nullable additive column).
-- ============================================================================

-- Index build + backfills exceed the default statement timeout at current
-- table sizes (~800k acl rows). Session-level SET (not SET LOCAL): the CLI
-- applies migration statements outside an explicit transaction block, where
-- SET LOCAL warns and does nothing. Reset at the end of the file.
-- 2h: the prod run reached the 4a/4b backfills at ~16 min before failing on
-- disk space, so 1h is likely enough — 2h is margin against a slow re-run.
set statement_timeout = '2h';

-- ----------------------------------------------------------------------------
-- PART 1: Column + index
-- ----------------------------------------------------------------------------

alter table public.asset_content_link
  add column if not exists audio_uploaded_at timestamptz;

comment on column public.asset_content_link.audio_uploaded_at is
  'Server-confirmed upload time of the audio object(s) in audio[]. Set by triggers from storage.objects.created_at. Clients must not write this column.';

-- The storage-side trigger below probes acl.audio with the jsonb "?" operator
-- on EVERY storage object insert. Without this index that is a sequential scan
-- of the whole table per upload (~63ms warm at 800k rows vs ~0.2ms indexed).
-- Default gin ops (jsonb_ops) — jsonb_path_ops does not support "?".
create index if not exists idx_asset_content_link_audio_gin
  on public.asset_content_link using gin (audio);

-- ----------------------------------------------------------------------------
-- PART 2: acl-side BEFORE INSERT trigger (object exists before the acl row)
-- ----------------------------------------------------------------------------

create or replace function public.set_acl_audio_uploaded_at_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_total int;
  v_matched int;
  v_uploaded timestamptz;
begin
  if new.audio is not null
     and jsonb_typeof(new.audio) = 'array'
     and jsonb_array_length(new.audio) > 0 then
    select count(distinct elem.name)
      into v_total
      from jsonb_array_elements_text(new.audio) as elem(name);

    select count(distinct elem.name), max(o.created_at)
      into v_matched, v_uploaded
      from jsonb_array_elements_text(new.audio) as elem(name)
      join storage.objects o
        on o.name = elem.name;

    -- Only stamp once every referenced object exists; a partial match means
    -- some audio is still awaiting upload.
    if v_matched = v_total then
      new.audio_uploaded_at := v_uploaded;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_set_acl_audio_uploaded_at on public.asset_content_link;

create trigger trigger_set_acl_audio_uploaded_at
  before insert on public.asset_content_link
  for each row
  execute function public.set_acl_audio_uploaded_at_on_insert();

comment on function public.set_acl_audio_uploaded_at_on_insert() is
  'On acl insert, stamp audio_uploaded_at once ALL storage.objects referenced by audio[] exist (newest created_at).';

-- ----------------------------------------------------------------------------
-- PART 3: storage-side AFTER INSERT trigger (acl row exists before the object)
-- ----------------------------------------------------------------------------

create or replace function public.set_acl_audio_uploaded_at_from_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  -- "audio ? new.name" uses the GIN index; the correlated checks below then
  -- run only against the handful of rows that reference this object.
  update public.asset_content_link acl
     set audio_uploaded_at = (
       select max(o.created_at)
         from jsonb_array_elements_text(acl.audio) as elem(name)
         join storage.objects o on o.name = elem.name
     )
   where acl.audio ? new.name
     and acl.audio_uploaded_at is null
     -- Only stamp once every element in audio[] has a matching object.
     and not exists (
       select 1
         from jsonb_array_elements_text(acl.audio) as elem(name)
        where not exists (
          select 1 from storage.objects o where o.name = elem.name
        )
     );

  return new;
end;
$$;

comment on function public.set_acl_audio_uploaded_at_from_object() is
  'On storage.objects insert, stamp audio_uploaded_at on acl rows referencing this object once all their audio[] objects exist.';

-- Creating a trigger on storage.objects requires ownership of the relation.
-- On hosted Supabase the postgres role can; local dev often cannot, so tolerate
-- insufficient_privilege there (mirrors supabase/seeds/storage.sql).
do $$
begin
  drop trigger if exists trigger_set_acl_audio_uploaded_at_from_object on storage.objects;
  create trigger trigger_set_acl_audio_uploaded_at_from_object
    after insert on storage.objects
    for each row
    execute function public.set_acl_audio_uploaded_at_from_object();
exception
  when insufficient_privilege then
    raise notice 'Insufficient privileges to create trigger on storage.objects - skipping (normal for local dev)';
end $$;

-- ----------------------------------------------------------------------------
-- PART 4: One-time backfills
-- ----------------------------------------------------------------------------

-- 4a. audio_uploaded_at for existing acl rows. Left join + HAVING ensures a
-- row is only stamped when every element in audio[] matched a storage object.
update public.asset_content_link acl
   set audio_uploaded_at = sub.uploaded
  from (
    select acl2.id, max(o.created_at) as uploaded
      from public.asset_content_link acl2
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(acl2.audio) = 'array'
             then acl2.audio
             else '[]'::jsonb
        end
      ) as elem(name)
      left join storage.objects o on o.name = elem.name
     group by acl2.id
    having count(*) = count(o.name)
  ) sub
 where acl.id = sub.id
   and acl.audio_uploaded_at is null;

-- 4b. uploaded_at for legacy rows. The uploaded_at columns were added
-- (20260505*, 20260520220000) with no backfill, so rows that predate them are
-- null forever. The client upload-progress indicator counts null uploaded_at
-- as "not yet confirmed", which would leave legacy quests stuck below 100%
-- permanently. These rows are on the server by definition, so treat their
-- created_at as the confirmation time. Covers all four tables the indicator
-- counts. One-time sync churn: these updates re-sync the affected rows to
-- clients via PowerSync.
update public.quest set uploaded_at = created_at where uploaded_at is null;
update public.quest_asset_link set uploaded_at = created_at where uploaded_at is null;
update public.asset set uploaded_at = created_at where uploaded_at is null;
-- asset_content_link.created_at is text (not timestamptz like the other three
-- tables), so it needs an explicit cast.
update public.asset_content_link set uploaded_at = created_at::timestamptz where uploaded_at is null;

-- ----------------------------------------------------------------------------
-- PART 5: Schema version bump (client reads the new column)
-- ----------------------------------------------------------------------------

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.5',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Version 2.5 adds asset_content_link.audio_uploaded_at (server-confirmed audio upload time).'
  );
$$;

reset statement_timeout;
