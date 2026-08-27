-- ============================================================================
-- Migration: Protect server-owned upload-confirmation columns
-- ============================================================================
--
-- PURPOSE:
-- uploaded_at (quest, quest_asset_link, asset, asset_content_link) and
-- audio_uploaded_at (asset_content_link) are server-stamped confirmation
-- fields. Clients must never write them, but until now nothing enforced
-- that: a PowerSync PUT replays every column of the local row, so a client
-- could echo stale synced-down values back and clobber the server's truth.
--
-- Defense layers (this migration is the real guarantee):
--   1. ESLint rule (dev-time guidance, client repo)
--   2. SupabaseConnector.uploadData strips both columns from outgoing CRUD
--   3. These guard triggers (server-side, client-version-agnostic)
--
-- HOW:
-- A BEFORE INSERT OR UPDATE trigger on each table reverts client-supplied
-- values when the statement executes as a client role (authenticated/anon):
--   - INSERT: NEW.col := null   (the stamping trigger then sets it)
--   - UPDATE: NEW.col := OLD.col
--
-- WHY current_user IS THE RIGHT CHECK:
-- Client writes arrive via apply_table_mutation_transaction, which is
-- SECURITY INVOKER — the DML executes as authenticated/anon, so the guard
-- fires. The legitimate writers all execute as the function owner
-- (postgres) via SECURITY DEFINER functions, so the guard passes them:
--   - set_*_uploaded_at BEFORE INSERT stamping functions
--   - set_acl_audio_uploaded_at_on_insert (acl-side audio stamp)
--   - set_acl_audio_uploaded_at_from_object (storage-side UPDATE of acl)
-- Migration backfills also run as postgres. Do NOT use auth.role() here:
-- it reads the request JWT, which stays 'authenticated' even inside
-- SECURITY DEFINER functions and would block the storage-side stamp.
--
-- TRIGGER ORDERING (critical):
-- BEFORE triggers on the same table fire in name order. This guard is named
-- trigger_guard_* so it runs before every trigger_set_* stamping trigger —
-- the guard nulls the client value first, then the stamp writes the real
-- one. Renaming either side can silently break this.
-- ============================================================================

set search_path = public;

create or replace function public.guard_upload_confirmation_columns()
returns trigger
language plpgsql
-- SECURITY INVOKER (default) on purpose: the function must observe the role
-- actually executing the DML statement.
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.uploaded_at := null;
    else
      new.uploaded_at := old.uploaded_at;
    end if;

    -- Only asset_content_link has audio_uploaded_at; plpgsql resolves record
    -- fields at runtime, so this branch never touches the other tables.
    if tg_table_name = 'asset_content_link' then
      if tg_op = 'INSERT' then
        new.audio_uploaded_at := null;
      else
        new.audio_uploaded_at := old.audio_uploaded_at;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_upload_confirmation_columns() is
  'Reverts client-supplied uploaded_at/audio_uploaded_at (server-owned, trigger-stamped). Fires only for authenticated/anon; SECURITY DEFINER stamping functions execute as their owner and pass.';

drop trigger if exists trigger_guard_upload_confirmation on public.quest;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.quest
  for each row
  execute function public.guard_upload_confirmation_columns();

drop trigger if exists trigger_guard_upload_confirmation on public.quest_asset_link;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.quest_asset_link
  for each row
  execute function public.guard_upload_confirmation_columns();

drop trigger if exists trigger_guard_upload_confirmation on public.asset;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.asset
  for each row
  execute function public.guard_upload_confirmation_columns();

drop trigger if exists trigger_guard_upload_confirmation on public.asset_content_link;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.asset_content_link
  for each row
  execute function public.guard_upload_confirmation_columns();
