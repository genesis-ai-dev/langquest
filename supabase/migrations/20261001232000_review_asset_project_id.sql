-- Path A: project_id is filled on the server so PowerSync can filter
-- review_asset without a join. Clients do not read or write this column.
-- No APP_SCHEMA_VERSION / get_schema_info() bump.
-- add column if not exists: safe when the column was created by hand first.

alter table public.review_asset
  add column if not exists project_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'review_asset_project_id_fkey'
       and conrelid = 'public.review_asset'::regclass
  ) then
    alter table public.review_asset
      add constraint review_asset_project_id_fkey
      foreign key (project_id) references public.project(id);
  end if;
end $$;

update public.review_asset ra
   set project_id = r.project_id
  from public.review r
 where r.id = ra.review_id
   and ra.project_id is distinct from r.project_id;

alter table public.review_asset
  alter column project_id set not null;

create index if not exists review_asset_project_id_idx
  on public.review_asset (project_id);

comment on column public.review_asset.project_id is
  'Copied from review.project_id so PowerSync can filter review_asset without a join. Clients must not write this column.';

create or replace function public.set_review_asset_project_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select r.project_id
    into new.project_id
    from public.review r
   where r.id = new.review_id;

  return new;
end;
$$;

drop trigger if exists trigger_set_review_asset_project_id on public.review_asset;
create trigger trigger_set_review_asset_project_id
  before insert or update on public.review_asset
  for each row
  execute function public.set_review_asset_project_id();

create or replace function public.copy_review_project_id_to_assets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.review_asset
     set project_id = new.project_id
   where review_id = new.id
     and project_id is distinct from new.project_id;

  return new;
end;
$$;

drop trigger if exists trigger_copy_review_project_id_to_assets on public.review;
create trigger trigger_copy_review_project_id_to_assets
  after update of project_id on public.review
  for each row
  execute function public.copy_review_project_id_to_assets();
