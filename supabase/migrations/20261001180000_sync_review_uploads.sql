-- Publish path for reviews.
-- Adds the server-stamped confirmation columns the client progress bars read,
-- and an audio column on review (overall feedback). review_asset.audio becomes
-- jsonb so it matches asset_content_link and the storage trigger.
-- No APP_SCHEMA_VERSION bump: columns are nullable and server-owned.

alter table public.review
  add column if not exists audio jsonb,
  add column if not exists uploaded_at timestamptz,
  add column if not exists audio_uploaded_at timestamptz;

alter table public.review_asset
  alter column audio type jsonb
  using case
    when audio is null then null
    else to_jsonb(audio)
  end;

alter table public.review_asset
  add column if not exists uploaded_at timestamptz,
  add column if not exists audio_uploaded_at timestamptz;

comment on column public.review.audio is
  'Overall feedback audio object names. Clients strip the local/ prefix before upload.';
comment on column public.review.uploaded_at is
  'Server-confirmed upload time of the review row. Clients must not write this column.';
comment on column public.review.audio_uploaded_at is
  'Server-confirmed upload time of every object in audio[]. Clients must not write this column.';
comment on column public.review_asset.uploaded_at is
  'Server-confirmed upload time of the review_asset row. Clients must not write this column.';
comment on column public.review_asset.audio_uploaded_at is
  'Server-confirmed upload time of every object in audio[]. Clients must not write this column.';

create index if not exists idx_review_audio_gin
  on public.review using gin (audio);
create index if not exists idx_review_asset_audio_gin
  on public.review_asset using gin (audio);

-- Guard runs before the stamp (name order: trigger_guard_* < trigger_set_*).
create or replace function public.guard_upload_confirmation_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.uploaded_at := null;
    else
      new.uploaded_at := old.uploaded_at;
    end if;

    if tg_table_name in ('asset_content_link', 'review', 'review_asset') then
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

drop trigger if exists trigger_guard_upload_confirmation on public.review;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.review
  for each row
  execute function public.guard_upload_confirmation_columns();

drop trigger if exists trigger_guard_upload_confirmation on public.review_asset;
create trigger trigger_guard_upload_confirmation
  before insert or update on public.review_asset
  for each row
  execute function public.guard_upload_confirmation_columns();

create or replace function public.stamp_review_row_upload()
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
  new.uploaded_at := now();

  if new.audio is not null
     and jsonb_typeof(new.audio) = 'array'
     and jsonb_array_length(new.audio) > 0 then
    select count(distinct elem.name)
      into v_total
      from jsonb_array_elements_text(new.audio) as elem(name);

    select count(distinct elem.name), max(o.created_at)
      into v_matched, v_uploaded
      from jsonb_array_elements_text(new.audio) as elem(name)
      join storage.objects o on o.name = elem.name;

    if v_matched = v_total then
      new.audio_uploaded_at := v_uploaded;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_set_review_uploaded_at on public.review;
create trigger trigger_set_review_uploaded_at
  before insert on public.review
  for each row
  execute function public.stamp_review_row_upload();

drop trigger if exists trigger_set_review_asset_uploaded_at on public.review_asset;
create trigger trigger_set_review_asset_uploaded_at
  before insert on public.review_asset
  for each row
  execute function public.stamp_review_row_upload();

create or replace function public.stamp_review_audio_from_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  update public.review r
     set audio_uploaded_at = (
       select max(o.created_at)
         from jsonb_array_elements_text(r.audio) as elem(name)
         join storage.objects o on o.name = elem.name
     )
   where r.audio ? new.name
     and r.audio_uploaded_at is null
     and not exists (
       select 1
         from jsonb_array_elements_text(r.audio) as elem(name)
        where not exists (
          select 1 from storage.objects o where o.name = elem.name
        )
     );

  update public.review_asset ra
     set audio_uploaded_at = (
       select max(o.created_at)
         from jsonb_array_elements_text(ra.audio) as elem(name)
         join storage.objects o on o.name = elem.name
     )
   where ra.audio ? new.name
     and ra.audio_uploaded_at is null
     and not exists (
       select 1
         from jsonb_array_elements_text(ra.audio) as elem(name)
        where not exists (
          select 1 from storage.objects o where o.name = elem.name
        )
     );

  return new;
end;
$$;

do $$
begin
  drop trigger if exists trigger_stamp_review_audio_from_object on storage.objects;
  create trigger trigger_stamp_review_audio_from_object
    after insert on storage.objects
    for each row
    execute function public.stamp_review_audio_from_object();
exception
  when insufficient_privilege then
    raise notice 'Insufficient privileges to create trigger on storage.objects - skipping (normal for local dev)';
end $$;

-- Reviews sync with their quest: download_profiles mirrors quest.download_profiles
-- on insert and whenever the quest is downloaded or offloaded.
alter table public.review
  add column if not exists download_profiles uuid[] not null default '{}';
alter table public.review_asset
  add column if not exists download_profiles uuid[] not null default '{}';

create index if not exists idx_review_download_profiles_gin
  on public.review using gin (download_profiles);
create index if not exists idx_review_asset_download_profiles_gin
  on public.review_asset using gin (download_profiles);

create or replace function public.copy_quest_download_profiles_to_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(q.download_profiles, '{}')
    into new.download_profiles
    from public.quest q
   where q.id = new.quest_id;

  new.download_profiles := coalesce(new.download_profiles, '{}');
  return new;
end;
$$;

drop trigger if exists trigger_copy_quest_download_profiles on public.review;
create trigger trigger_copy_quest_download_profiles
  before insert on public.review
  for each row
  execute function public.copy_quest_download_profiles_to_review();

create or replace function public.copy_review_download_profiles_to_review_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(r.download_profiles, '{}')
    into new.download_profiles
    from public.review r
   where r.id = new.review_id;

  new.download_profiles := coalesce(new.download_profiles, '{}');
  return new;
end;
$$;

drop trigger if exists trigger_copy_review_download_profiles on public.review_asset;
create trigger trigger_copy_review_download_profiles
  before insert on public.review_asset
  for each row
  execute function public.copy_review_download_profiles_to_review_asset();

create or replace function public.propagate_quest_download_profiles_to_reviews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profiles uuid[] := coalesce(new.download_profiles, '{}');
begin
  update public.review r
     set download_profiles = v_profiles
   where r.quest_id = new.id
     and r.download_profiles is distinct from v_profiles;

  update public.review_asset ra
     set download_profiles = v_profiles
    from public.review r
   where r.id = ra.review_id
     and r.quest_id = new.id
     and ra.download_profiles is distinct from v_profiles;

  return null;
end;
$$;

drop trigger if exists trigger_propagate_download_profiles_to_reviews on public.quest;
create trigger trigger_propagate_download_profiles_to_reviews
  after update of download_profiles on public.quest
  for each row
  when (old.download_profiles is distinct from new.download_profiles)
  execute function public.propagate_quest_download_profiles_to_reviews();

update public.review r
   set download_profiles = coalesce(q.download_profiles, '{}')
  from public.quest q
 where q.id = r.quest_id;

update public.review_asset ra
   set download_profiles = r.download_profiles
  from public.review r
 where r.id = ra.review_id;

-- PowerSync only replicates tables in this publication; without it the
-- server-stamped confirmation columns never sync down.
alter publication powersync add table only public.review;
alter publication powersync add table only public.review_asset;
