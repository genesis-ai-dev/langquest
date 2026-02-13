-- Migration: Add fia_available languoid_property rows
-- Purpose: Mark languages that have FIA (Familiarize-Internalize-Articulate) content available
-- Affected tables: languoid, languoid_property
--
-- Step 1 ensures the 14 FIA languoid records exist (they exist in production;
-- in local/dev the seed data will later upsert them with ui_ready, etc.).
-- Step 2 inserts fia_available='true' properties for each.
-- Both steps are idempotent.

-- Step 1: Ensure FIA languoid records exist
-- In production these already exist (ON CONFLICT skips).
-- In local/dev these are created here so Step 2's FK references are satisfied;
-- the seed data will then upsert them with correct ui_ready values.
insert into public.languoid (id, parent_id, name, level, ui_ready, active, created_at, last_updated)
values
  ('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', null, 'English', 'language', false, true, now(), now()),
  ('a1cb9ca9-8f6d-400b-a071-544a32ea1d82', null, 'Portuguese', 'language', false, true, now(), now()),
  ('155f40c3-cb64-4fdd-aaf7-a55acb42c755', null, 'French', 'language', false, true, now(), now()),
  ('57f410a6-a182-4126-b7ce-45e1280d0cfc', null, 'Indonesian', 'language', false, true, now(), now()),
  ('2e229bf3-06b7-40ce-b735-1499257c7fef', null, 'Russian', 'language', false, true, now(), now()),
  ('db0ae9dd-35f5-4f04-8f2e-e014c7fb0110', null, 'Swahili', 'language', false, true, now(), now()),
  ('3502e2a1-3cfd-45f7-8167-a9a67d42c76a', null, 'Hindi', 'language', false, true, now(), now()),
  ('8cde1960-ad33-41a5-bfdd-bcd92b00e4f3', null, 'Standard Arabic', 'language', false, true, now(), now()),
  ('0d75d06f-2692-4127-b810-67dd64fa6eee', null, 'Mandarin Chinese', 'language', false, true, now(), now()),
  ('6f800df3-05d2-455b-9a88-a077d1f111cc', null, 'Tok Pisin', 'language', false, true, now(), now()),
  ('b032faf4-aebf-4848-984d-053eccc54f1f', null, 'Spanish', 'language', false, true, now(), now()),
  ('80293000-c406-4390-8de1-67b7ac11ce14', null, 'Persian', 'language', false, true, now(), now()),
  ('accfea8f-9b17-4bf7-96b2-56e81196267c', null, 'Sudanese Arabic', 'language', false, true, now(), now()),
  ('0191cd2b-d151-4217-a7d4-19b2346c7b7e', null, 'Bislama', 'language', false, true, now(), now())
on conflict (id) do nothing;

-- Step 2: Insert fia_available property for each FIA language
insert into public.languoid_property (languoid_id, key, value, active, created_at, last_updated)
values
  ('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fia_available', 'true', true, now(), now()),
  ('a1cb9ca9-8f6d-400b-a071-544a32ea1d82', 'fia_available', 'true', true, now(), now()),
  ('155f40c3-cb64-4fdd-aaf7-a55acb42c755', 'fia_available', 'true', true, now(), now()),
  ('57f410a6-a182-4126-b7ce-45e1280d0cfc', 'fia_available', 'true', true, now(), now()),
  ('2e229bf3-06b7-40ce-b735-1499257c7fef', 'fia_available', 'true', true, now(), now()),
  ('db0ae9dd-35f5-4f04-8f2e-e014c7fb0110', 'fia_available', 'true', true, now(), now()),
  ('3502e2a1-3cfd-45f7-8167-a9a67d42c76a', 'fia_available', 'true', true, now(), now()),
  ('8cde1960-ad33-41a5-bfdd-bcd92b00e4f3', 'fia_available', 'true', true, now(), now()),
  ('0d75d06f-2692-4127-b810-67dd64fa6eee', 'fia_available', 'true', true, now(), now()),
  ('6f800df3-05d2-455b-9a88-a077d1f111cc', 'fia_available', 'true', true, now(), now()),
  ('b032faf4-aebf-4848-984d-053eccc54f1f', 'fia_available', 'true', true, now(), now()),
  ('80293000-c406-4390-8de1-67b7ac11ce14', 'fia_available', 'true', true, now(), now()),
  ('accfea8f-9b17-4bf7-96b2-56e81196267c', 'fia_available', 'true', true, now(), now()),
  ('0191cd2b-d151-4217-a7d4-19b2346c7b7e', 'fia_available', 'true', true, now(), now())
on conflict (languoid_id, key) do nothing;
