create extension if not exists pgcrypto;

create table if not exists public.template_structure (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null,
  template text not null,
  language text not null,
  type text not null,
  title text not null,
  item_id text null,
  item_count integer null,
  order_index integer null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  constraint template_structure_parent_id_fkey
    foreign key (parent_id)
    references public.template_structure(id)
    on delete cascade
);

create index if not exists idx_template_structure_parent_id
on public.template_structure(parent_id);

create index if not exists idx_template_structure_parent_order
on public.template_structure(parent_id, order_index);

create index if not exists idx_template_structure_template_language
on public.template_structure(template, language);

create index if not exists idx_template_structure_type
on public.template_structure(type);

create index if not exists idx_template_structure_item_id
on public.template_structure(item_id);

create or replace function public.set_last_updated()
returns trigger as $$
begin
  new.last_updated = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_last_updated on public.template_structure;

create trigger trg_set_last_updated
before update on public.template_structure
for each row
execute function public.set_last_updated();

alter table public.template_structure enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'template_structure'
      and policyname = 'template_structure_service_role_all'
  ) then
    create policy template_structure_service_role_all
      on public.template_structure
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
