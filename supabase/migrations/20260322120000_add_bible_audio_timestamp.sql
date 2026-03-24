-- Migration: Add bible_audio_timestamp for custom chapter-level verse timestamps
-- Purpose: Store generated timestamps keyed by Bible Brain audio fileset + book + chapter.
--          Edge function prefers these over Bible Brain /timestamps API.

create table public.bible_audio_timestamp (
  id uuid primary key default gen_random_uuid(),
  audio_fileset_id text not null,
  bible_id text,
  book_id text not null,
  chapter integer not null,
  timestamps jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bible_audio_timestamp_unique
    unique (audio_fileset_id, book_id, chapter)
);

comment on table public.bible_audio_timestamp is 'Custom verse-level audio timestamps per chapter; preferred over Bible Brain API when present.';

comment on column public.bible_audio_timestamp.timestamps is 'JSON array: [{"verseStart": number, "timestamp": number}] (seconds in chapter audio).';

alter table public.bible_audio_timestamp enable row level security;
