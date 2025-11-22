-- Migration: Add full-text search for contextual translation examples
-- Purpose: Enable PostgreSQL full-text search on asset_content_link.text to find contextually relevant translation examples
-- Affected tables: asset_content_link
-- Notes: Uses PostgreSQL's built-in tsvector for fast, keyword-based similarity search

set check_function_bodies = off;
set search_path = public;

-- Add tsvector column for full-text search
alter table public.asset_content_link 
  add column if not exists text_search_vector tsvector;

-- Create GIN index for fast full-text search queries
create index if not exists asset_content_link_text_search_idx 
  on public.asset_content_link using gin(text_search_vector);

-- Function to update text_search_vector from text column
create or replace function public.asset_content_link_update_text_search_vector()
returns trigger
language plpgsql
as $$
begin
  -- Update tsvector from text, using 'simple' configuration (no stemming)
  -- This works well for multilingual content
  new.text_search_vector := to_tsvector('simple', coalesce(new.text, ''));
  return new;
end;
$$;

-- Trigger to automatically update text_search_vector when text changes
drop trigger if exists asset_content_link_text_search_vector_trigger on public.asset_content_link;
create trigger asset_content_link_text_search_vector_trigger
  before insert or update of text on public.asset_content_link
  for each row
  execute function public.asset_content_link_update_text_search_vector();

-- Backfill existing rows
update public.asset_content_link
set text_search_vector = to_tsvector('simple', coalesce(text, ''))
where text_search_vector is null;

