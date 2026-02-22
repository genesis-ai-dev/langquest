-- Migration: Fix languoid_source unique constraint and add missing iso639-3 records
--
-- 1. Replace the unique constraint on (languoid_id, unique_identifier) with
--    (languoid_id, name, unique_identifier). The old constraint incorrectly
--    prevented different sources (e.g. wals and iso639-3) from sharing the
--    same identifier code for the same languoid, even though those are
--    independent source systems.
--
-- 2. Insert missing iso639-3 records for FIA languoids that need them for
--    Bible Brain bible lookups.
--
-- Affected languoids: English, Hindi, Portuguese, Russian, Spanish, Tok Pisin

-- Step 1: Replace the unique constraint to include source name
alter table public.languoid_source
  drop constraint if exists uq_languoid_source;

alter table public.languoid_source
  add constraint uq_languoid_source unique (languoid_id, name, unique_identifier);

-- Step 2: Insert missing iso639-3 source records
-- download_profiles are copied from the parent languoid record to maintain
-- consistent sync visibility.
insert into public.languoid_source (name, languoid_id, unique_identifier, active, download_profiles, created_at, last_updated)
select
  'iso639-3',
  l.id,
  v.iso_code,
  true,
  l.download_profiles,
  now(),
  now()
from (
  values
    ('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1'::uuid, 'eng'),
    ('3502e2a1-3cfd-45f7-8167-a9a67d42c76a'::uuid, 'hin'),
    ('a1cb9ca9-8f6d-400b-a071-544a32ea1d82'::uuid, 'por'),
    ('2e229bf3-06b7-40ce-b735-1499257c7fef'::uuid, 'rus'),
    ('b032faf4-aebf-4848-984d-053eccc54f1f'::uuid, 'spa'),
    ('6f800df3-05d2-455b-9a88-a077d1f111cc'::uuid, 'tpi')
) as v(languoid_id, iso_code)
join public.languoid l on l.id = v.languoid_id
where not exists (
  select 1
  from public.languoid_source ls
  where ls.languoid_id = v.languoid_id
    and ls.name = 'iso639-3'
    and ls.active = true
);
