-- Migration: Add missing iso639-3 languoid_source records
--
-- Several languoids used by FIA projects are missing iso639-3 source records,
-- which are needed by the bible-brain-content edge function to look up
-- Bible Brain bibles for those languages.
--
-- Affected languoids: English, Hindi, Portuguese, Russian, Spanish, Tok Pisin
--
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
