-- migration: copy source download_profiles on insert
-- purpose:
-- - when inserting a new asset that references a source asset (source_asset_id),
--   copy the source asset's download_profiles into the new asset's download_profiles
-- - when inserting a new asset_content_link (acl), copy the download_profiles from the
--   source asset of the asset the acl links to into the acl's download_profiles
-- affected tables: public.asset, public.asset_content_link
-- considerations:
-- - triggers run before insert and simply populate download_profiles; they do not modify other fields

set search_path = public;

-- function: copy source asset download_profiles to new asset
create or replace function public.copy_source_download_profiles_to_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_asset_id is not null then
    select a.download_profiles
    into new.download_profiles
    from public.asset a
    where a.id = new.source_asset_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_copy_source_download_profiles_on_asset on public.asset;
create trigger trg_copy_source_download_profiles_on_asset
before insert on public.asset
for each row
execute function public.copy_source_download_profiles_to_asset();


-- function: copy source asset download_profiles to new asset_content_link (acl)
create or replace function public.copy_source_download_profiles_to_acl()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_asset_id uuid;
begin
  -- find the source asset of the asset this acl links to
  select a.source_asset_id
  into v_source_asset_id
  from public.asset a
  where a.id = new.asset_id;

  if v_source_asset_id is not null then
    select a2.download_profiles
    into new.download_profiles
    from public.asset a2
    where a2.id = v_source_asset_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_copy_source_download_profiles_on_acl on public.asset_content_link;
create trigger trg_copy_source_download_profiles_on_acl
before insert on public.asset_content_link
for each row
execute function public.copy_source_download_profiles_to_acl();

comment on function public.copy_source_download_profiles_to_asset is 'BEFORE INSERT trigger fn: if new.asset has a source_asset_id, copy the source asset''s download_profiles into new.download_profiles';
comment on function public.copy_source_download_profiles_to_acl is 'BEFORE INSERT trigger fn: copy download_profiles from the source asset of the linked asset into new ACL row';


