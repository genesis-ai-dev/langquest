-- Migration: Add versification_template to project
-- Context: client schema version 2.1

-- Increase timeout for potential backfill cost
set statement_timeout = '30min';

alter table public.project
  add column if not exists versification_template text;

-- Backfill existing rows to the initial template
update public.project
set versification_template = 'protestant'
where versification_template is null;

comment on column public.project.versification_template is
  'Versification template used by the project (e.g., protestant)';
