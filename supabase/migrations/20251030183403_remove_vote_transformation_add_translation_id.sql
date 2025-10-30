-- Migration: Remove vote transformation from v0_to_v1 and add translation_id to vote table
-- Purpose:
-- - Remove vote transformation logic from v0_to_v1 function (vote records should use asset_id directly)
-- - Remove before_vote_mutation trigger and route_vote_via_mutation function
-- - Add translation_id column (nullable, no FK) to vote table for tracking purposes
-- - Ensure asset_id is NOT NULL with foreign key constraint to asset table
-- - Add BEFORE INSERT trigger to automatically copy translation_id to asset_id before insertion
-- - Drop public.asset_vote table and all its dependencies (triggers, functions, RLS policies, indexes)
-- Affected objects: public.v0_to_v1 (function), public.vote (table), public.route_vote_via_mutation (function), public.asset_vote (table)
-- Special considerations: translation_id is nullable without FK constraint. asset_id is NOT NULL with FK to asset.
--                        The trigger fires BEFORE INSERT to copy translation_id to asset_id before FK validation.

-- Recreate v0_to_v1 function without vote transformation logic
create or replace function public.v0_to_v1(
  p_ops public.mutation_op[],
  p_meta jsonb
)
returns public.mutation_op[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  new_ops public.mutation_op[] := '{}';
  v_meta text := coalesce(p_meta->>'metadata', '');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  v_id uuid;
  v_parent_id uuid;
  v_acl_id uuid;
  v_active bool;
  v_qal_quest_id uuid;
  v_qal_visible boolean;
begin
  raise log '[v0_to_v1] start meta=% is_v0=% ops_count=%',
    v_meta,
    v_version_is_v0,
    coalesce(array_length(p_ops,1),0);

  foreach op in array p_ops loop
    raise log '[v0_to_v1] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    if v_version_is_v0 and lower(op.table_name) = 'translation' then
      -- Gather IDs / derived fields
      begin v_id := (op.record->>'id')::uuid; exception when others then v_id := gen_random_uuid(); end;
      begin v_parent_id := (op.record->>'asset_id')::uuid; exception when others then v_parent_id := null; end;
      v_acl_id := gen_random_uuid();
      v_active := coalesce((op.record->>'active')::boolean, true);

      raise log '[v0_to_v1] translation map: new_variant_asset_id=% parent_asset_id=% acl_id=% active=%',
        v_id, v_parent_id, v_acl_id, v_active;

      -- 1) asset (variant row)
      new_ops := new_ops || (row(
        'asset',
        case when lower(op.op) = 'delete' then 'delete' else 'put' end,
        jsonb_build_object(
          'id', v_id,
          'source_asset_id', v_parent_id,
          'active', v_active,
          'visible', coalesce((op.record->>'visible')::boolean, true),
          'creator_id', (op.record->>'creator_id')::uuid,
          'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb),
          'created_at', op.record->>'created_at',
          'last_updated', op.record->>'last_updated'
        )
      ))::public.mutation_op;

      -- 2) asset_content_link (text, lang binding) for put/patch
      if lower(op.op) in ('put','patch','update') then
        new_ops := new_ops || (row(
          'asset_content_link',
          'put',
          (
            (op.record - 'target_language_id' - 'asset_id' - 'creator_id' - 'visible')
            || jsonb_build_object(
                'id', v_acl_id::text,
                'asset_id', v_id::text,
                'source_language_id', op.record->>'target_language_id'
              )
          )
        ))::public.mutation_op;
      end if;

      -- 3) quest_asset_link for each quest that currently links the parent asset
      -- Mirrors logic in 20251008120001_modernize_schema_structure.sql Step 3
      for v_qal_quest_id, v_qal_visible in
        select qal.quest_id, qal.visible
        from public.quest_asset_link qal
        where qal.asset_id = v_parent_id and qal.active = true
      loop
        new_ops := new_ops || (row(
          'quest_asset_link',
          'put',
          jsonb_build_object(
            'quest_id', v_qal_quest_id::text,
            'asset_id', v_id::text,
            'active', v_active,
            'created_at', op.record->>'created_at',
            'last_updated', op.record->>'last_updated',
            'visible', v_qal_visible,
            'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb)
          )
        ))::public.mutation_op;
      end loop;

      raise log '[v0_to_v1] translation produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    else
      -- passthrough (vote transformation logic removed)
      out_ops := out_ops || op;
    end if;
  end loop;

  raise log '[v0_to_v1] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  return out_ops;
end;
$$;

-- Remove vote-related trigger and function
drop trigger if exists before_vote_mutation on public.vote;
drop function if exists public.route_vote_via_mutation();

-- Drop asset_vote table and all its dependencies
-- First, drop triggers
drop trigger if exists trigger_copy_asset_download_profiles_to_asset_vote on public.asset_vote;

-- Drop function used by asset_vote trigger
drop function if exists public.copy_asset_download_profiles_to_asset_vote();

-- Remove from PowerSync publication if it exists
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'asset_vote'
  ) then
    alter publication "powersync" drop table public.asset_vote;
  end if;
end $$;

-- Drop the asset_vote table (CASCADE will drop dependent objects like indexes, constraints, RLS policies)
drop table if exists public.asset_vote cascade;

-- Add translation_id column to vote table (nullable, no FK constraint)
-- Ensure asset_id is NOT NULL with foreign key constraint to asset table
do $$
begin
  -- Add translation_id column if it doesn't exist (nullable, no FK constraint)
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vote'
      and column_name = 'translation_id'
  ) then
    alter table public.vote
    add column translation_id uuid null;
  else
    -- If it exists, ensure it's nullable (drop NOT NULL if present)
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vote'
        and column_name = 'translation_id'
        and is_nullable = 'NO'
    ) then
      alter table public.vote
      alter column translation_id drop not null;
    end if;
  end if;

  -- Drop any existing foreign key constraint on translation_id (we don't want FK on this column)
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'vote'
      and constraint_name = 'vote_translation_id_fkey'
  ) then
    alter table public.vote
    drop constraint vote_translation_id_fkey;
  end if;

  -- Ensure asset_id is NOT NULL with foreign key constraint to asset table
  -- First, handle existing foreign key constraint if it exists
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'vote'
      and constraint_name = 'vote_asset_id_fkey'
  ) then
    -- Drop existing constraint temporarily to modify column
    alter table public.vote
    drop constraint vote_asset_id_fkey;
  end if;

  -- Make asset_id NOT NULL (if it's currently nullable)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vote'
      and column_name = 'asset_id'
      and is_nullable = 'YES'
  ) then
    -- Update any NULL asset_id values first (use translation_id if available, or set a default)
    -- This handles edge cases where existing records might have NULL asset_id
    update public.vote
    set asset_id = coalesce(translation_id, asset_id)
    where asset_id is null
      and translation_id is not null;

    -- For any remaining NULL values, we'll need to handle them or raise an error
    -- For now, we'll set NOT NULL and let the constraint handle invalid data
    alter table public.vote
    alter column asset_id set not null;
  end if;

  -- Recreate foreign key constraint for asset_id (NOT NULL)
  alter table public.vote
  add constraint vote_asset_id_fkey
  foreign key (asset_id)
  references public.asset (id)
  on update cascade
  on delete restrict;

  -- Ensure index exists for translation_id lookups (even without FK)
  create index if not exists vote_translation_id_idx
  on public.vote using btree (translation_id);
end $$;

-- Create function to move translation_id to asset_id before insertion
create or replace function public.move_translation_id_to_asset_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- If translation_id is provided, copy it to asset_id before insertion
  if new.translation_id is not null then
    new.asset_id := new.translation_id;
  end if;

  return new;
end;
$$;

-- Create BEFORE INSERT trigger on vote table
drop trigger if exists trg_move_translation_id_to_asset_id on public.vote;
create trigger trg_move_translation_id_to_asset_id
before insert on public.vote
for each row
execute function public.move_translation_id_to_asset_id();

comment on function public.move_translation_id_to_asset_id() is 'Before inserting a vote record, copies translation_id to asset_id to maintain backward compatibility with the asset-based vote system.';

