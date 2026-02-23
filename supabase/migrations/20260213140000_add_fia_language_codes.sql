-- Migration: Add FIA language codes and missing ISO 639-3 records
-- Purpose: Store the exact FIA API language code for each FIA language
--          (which may differ from our ISO 639-3 code, e.g. Swahili: FIA=swa, ISO=swh)
--          Also add missing languoid_source iso639-3 records for FIA languages
-- Affected tables: languoid_property, languoid_source
-- All steps are idempotent.

-- Step 1: Insert fia_language_code property for each FIA language
-- These are the exact codes used by the FIA GraphQL API (language.id field)
insert into public.languoid_property (languoid_id, key, value, active, created_at, last_updated)
values
  ('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fia_language_code', 'eng', true, now(), now()),
  ('a1cb9ca9-8f6d-400b-a071-544a32ea1d82', 'fia_language_code', 'por', true, now(), now()),
  ('155f40c3-cb64-4fdd-aaf7-a55acb42c755', 'fia_language_code', 'fra', true, now(), now()),
  ('57f410a6-a182-4126-b7ce-45e1280d0cfc', 'fia_language_code', 'ind', true, now(), now()),
  ('2e229bf3-06b7-40ce-b735-1499257c7fef', 'fia_language_code', 'rus', true, now(), now()),
  ('db0ae9dd-35f5-4f04-8f2e-e014c7fb0110', 'fia_language_code', 'swa', true, now(), now()),
  ('3502e2a1-3cfd-45f7-8167-a9a67d42c76a', 'fia_language_code', 'hin', true, now(), now()),
  ('8cde1960-ad33-41a5-bfdd-bcd92b00e4f3', 'fia_language_code', 'arb', true, now(), now()),
  ('0d75d06f-2692-4127-b810-67dd64fa6eee', 'fia_language_code', 'cmn', true, now(), now()),
  ('6f800df3-05d2-455b-9a88-a077d1f111cc', 'fia_language_code', 'tpi', true, now(), now()),
  ('b032faf4-aebf-4848-984d-053eccc54f1f', 'fia_language_code', 'spa', true, now(), now()),
  ('80293000-c406-4390-8de1-67b7ac11ce14', 'fia_language_code', 'fas', true, now(), now()),
  ('accfea8f-9b17-4bf7-96b2-56e81196267c', 'fia_language_code', 'apd', true, now(), now()),
  ('0191cd2b-d151-4217-a7d4-19b2346c7b7e', 'fia_language_code', 'bis', true, now(), now())
on conflict (languoid_id, key) do nothing;

-- Step 2: Add missing languoid_source iso639-3 records
-- Production already has records for: bis, cmn, fra, ind, arb, apd, swh
-- Missing: eng, por, rus, hin, tpi, spa, fas
insert into public.languoid_source (name, languoid_id, unique_identifier, active, created_at, last_updated)
values
  ('iso639-3', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'eng', true, now(), now()),
  ('iso639-3', 'a1cb9ca9-8f6d-400b-a071-544a32ea1d82', 'por', true, now(), now()),
  ('iso639-3', '2e229bf3-06b7-40ce-b735-1499257c7fef', 'rus', true, now(), now()),
  ('iso639-3', '3502e2a1-3cfd-45f7-8167-a9a67d42c76a', 'hin', true, now(), now()),
  ('iso639-3', '6f800df3-05d2-455b-9a88-a077d1f111cc', 'tpi', true, now(), now()),
  ('iso639-3', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'spa', true, now(), now()),
  ('iso639-3', '80293000-c406-4390-8de1-67b7ac11ce14', 'fas', true, now(), now())
on conflict (languoid_id, unique_identifier) do nothing;

-- Step 3: Update project template check constraint to allow 'fia' template
-- The original constraint (from 20251008120001) only allowed 'unstructured' and 'bible'.
alter table public.project drop constraint if exists project_template_check;
alter table public.project add constraint project_template_check
  check (template in ('unstructured', 'bible', 'fia') or template is null);
