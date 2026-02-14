SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.6
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: profile; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profile" ("id", "created_at", "last_updated", "username", "password", "email", "ui_language_id", "ui_languoid_id", "active", "terms_accepted", "terms_accepted_at") VALUES
	('7c8863d2-fcba-4f72-9d48-2e15949dbb0d', '2025-01-30 04:16:03.397675+00', '2025-01-30 04:16:03.397675+00', 'Dodira', NULL, 'dodira5836@rykone.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('72a0344c-c687-42a2-9e03-64b287105ec1', '2025-01-31 23:35:12.788215+00', '2025-01-31 23:35:12.788215+00', 'Wallaby', NULL, 'common.wallaby.kwyn@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('44a2a0c1-4bb1-4c4d-9121-5b0da6676142', '2025-02-01 03:43:50.964698+00', '2025-02-01 03:43:50.964698+00', 'Flea', NULL, 'comprehensive.flea.umwb@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('557ef72c-4e78-44c1-bb44-e75e8e4743ea', '2025-02-03 19:02:05.290686+00', '2025-02-03 19:02:05.290686+00', 'Caterpillar', NULL, 'retail.caterpillar.vnih@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('c2115199-ee01-4006-8af9-35774d770146', '2025-02-03 21:20:39.038605+00', '2025-02-03 21:20:39.038605+00', 'Lemur', NULL, 'influential.lemur.lrji@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('23f77011-86f0-41fa-99ba-34d62c058143', '2025-02-07 00:06:13.841558+00', '2025-02-07 00:06:13.841558+00', 'Viper', NULL, 'scornful.viper.uyca@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('77acb538-4e38-4d72-935c-47d554a687ab', '2025-02-07 04:54:38.554155+00', '2025-02-07 04:54:38.554155+00', 'Nightingale', NULL, 'extreme.nightingale.bihh@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('a42f180f-c949-4a2d-a1cf-27cea1799f21', '2025-02-07 23:48:40.924084+00', '2025-02-07 23:48:40.924084+00', 'Badger', NULL, 'international.badger.wpqb@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('c6930ab1-b6bd-42d1-b086-a81a79aa27d7', '2025-02-11 23:58:30.254704+00', '2025-02-11 23:58:30.254704+00', 'Worm', NULL, 'important.roundworm.vimq@letterguard.net', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', true, false, NULL),
	('528d0cb1-6622-40c6-b3bf-98540969c67e', '2025-02-12 06:22:56.357054+00', '2025-02-12 06:22:56.357054+00', 'Capybara', NULL, 'full.capybara.nlul@letterguard.net', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', true, false, NULL),
	('f326de7c-fb02-4da0-adf0-4c8c65fa4d03', '2025-02-12 06:55:36.019876+00', '2025-02-12 06:55:36.019876+00', 'Giraffe', NULL, 'mixed.giraffe.dngf@letterguard.net', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', true, false, NULL),
	('a7fa1539-ec76-443c-a851-c30197397d54', '2025-02-12 18:36:26.56749+00', '2025-02-12 18:36:26.56749+00', 'Flea', NULL, 'overall.flea.cfvf@letterguard.net', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', true, false, NULL),
	('0c4e1afd-88ad-475f-b72d-681721f8d560', '2025-02-12 23:35:52.011919+00', '2025-02-12 23:35:52.011919+00', 'Walrus', NULL, 'reluctant.walrus.sjzn@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('8f3a6249-9269-435d-9bf7-f60ae81ee27a', '2025-02-14 19:13:01.89991+00', '2025-02-14 19:13:01.89991+00', 'ryder', NULL, 'ryderwishart@gmail.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '2025-02-15 04:48:16.854153+00', '2025-02-15 04:48:16.854153+00', 'Goose', NULL, 'delicate.goose.wjuk@letterguard.net', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('fd56eb4e-0b54-4715-863c-f865aee0b16d', '2024-12-28 21:40:32.521063+00', '2024-12-28 21:40:32.521063+00', 'Caleb', NULL, 'caleb@caleb.com', NULL, NULL, true, false, NULL),
	('7fd7be49-fa89-4b78-a93d-e728fe810110', '2024-12-28 23:31:36.246915+00', '2024-12-28 23:31:36.246915+00', 'Milhouse', NULL, 'milhouse@milhouse.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('135167eb-7a93-4d90-8b00-85508facac71', '2025-01-08 17:42:10.974563+00', '2025-01-08 17:42:10.974563+00', 'Ryder', NULL, 'ryder@ryder.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('d5a37d36-6376-4e34-9005-22ce17ec2c36', '2025-01-08 20:33:05.900419+00', '2025-01-08 20:33:05.900419+00', 'randallt', NULL, 'rrsrsrandallktan@hotmail.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('f2adf435-fd35-4927-8644-9b03785722b5', '2025-02-19 18:06:29.610079+00', '2025-02-19 18:06:29.610079+00', 'Keean2', NULL, '422eanboi@gmail.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('59b05eb2-d3b8-4292-975a-45f9c614e58f', '2025-03-10 20:49:17.040094+00', '2025-03-10 20:49:17.040094+00', 'ryder10032025_2', NULL, 'ryderwishart+langquest10032025@gmail.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, false, NULL),
	('c111d43b-5983-4342-9d9e-5fc8d09d77b9', '2025-01-19 00:13:31.935664+00', '2025-01-19 00:13:31.935664+00', 'Keean', NULL, 'realdinozoid@gmail.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, true, NULL),
	('ff6e4bb4-3840-4168-917a-d29e09145958', '2025-03-06 18:20:56.649327+00', '2025-03-06 18:20:56.649327+00', 'BenScholtens', NULL, 'ben.scholtens@me.com', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', true, true, NULL);


--
-- Data for Name: language; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."language" ("id", "created_at", "last_updated", "native_name", "english_name", "iso639_3", "ui_ready", "creator_id", "active", "locale") VALUES
	('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'English', 'English', 'eng', true, NULL, true, 'en'),
	('b032faf4-aebf-4848-984d-053eccc54f1f', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Español', 'Spanish', 'spa', true, NULL, true, 'es'),
	('9e3f8bd9-c2e5-4f5a-b98d-123456789012', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Tu''un Savi', 'Mixteco de Penasco', 'mil', false, NULL, true, NULL),
	('4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Diidxazá', 'Zapoteco de Santiago', 'zas', false, NULL, true, NULL),
	('2f1e3d4c-5b6a-7890-1234-567890abcdef', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Nuntajɨ̃yi', 'Popoluca', 'poi', false, NULL, true, NULL),
	('ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', '2025-03-13 00:31:36.819037+00', '2025-03-13 00:31:36.819037+00', 'Universal', 'Universal', 'unv', false, NULL, true, NULL);


--
-- Data for Name: languoid; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."languoid" ("id", "parent_id", "name", "level", "ui_ready", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', NULL, 'English', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b032faf4-aebf-4848-984d-053eccc54f1f', NULL, 'Spanish', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('9e3f8bd9-c2e5-4f5a-b98d-123456789012', NULL, 'Mixteco de Penasco', 'language', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('4a8b7c6d-5e4f-3a2b-1c9d-987654321098', NULL, 'Zapoteco de Santiago', 'language', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('2f1e3d4c-5b6a-7890-1234-567890abcdef', NULL, 'Popoluca', 'language', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', NULL, 'Universal', 'language', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('7a735df4-4f4e-4a03-b60e-eb7911152cf4', NULL, 'Nepali', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', NULL, 'Brazilian Portuguese', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('6f800df3-05d2-455b-9a88-a077d1f111cc', NULL, 'Tok Pisin', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('57f410a6-a182-4126-b7ce-45e1280d0cfc', NULL, 'Indonesian', 'language', true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	ui_ready = EXCLUDED.ui_ready,
	active = EXCLUDED.active;


--
-- Data for Name: languoid_alias; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."languoid_alias" ("id", "subject_languoid_id", "label_languoid_id", "name", "alias_type", "source_names", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('a1a1a1a1-0001-4000-8000-000000000001', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'English', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0002-4000-8000-000000000002', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'Español', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0003-4000-8000-000000000003', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Tu''un Savi', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0004-4000-8000-000000000004', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Diidxazá', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0005-4000-8000-000000000005', '2f1e3d4c-5b6a-7890-1234-567890abcdef', '2f1e3d4c-5b6a-7890-1234-567890abcdef', 'Nuntajɨ̃yi', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0006-4000-8000-000000000006', '7a735df4-4f4e-4a03-b60e-eb7911152cf4', '7a735df4-4f4e-4a03-b60e-eb7911152cf4', 'नेपाली', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0007-4000-8000-000000000007', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Português Brasileiro', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0008-4000-8000-000000000008', '6f800df3-05d2-455b-9a88-a077d1f111cc', '6f800df3-05d2-455b-9a88-a077d1f111cc', 'Tok Pisin', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('a1a1a1a1-0009-4000-8000-000000000009', '57f410a6-a182-4126-b7ce-45e1280d0cfc', '57f410a6-a182-4126-b7ce-45e1280d0cfc', 'Bahasa Indonesia', 'endonym', ARRAY['lexvo'], true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL);


--
-- Data for Name: languoid_source; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."languoid_source" ("id", "name", "version", "languoid_id", "unique_identifier", "url", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('b2b2b2b2-0001-4000-8000-000000000001', 'iso639-3', NULL, 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'eng', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0002-4000-8000-000000000002', 'iso639-3', NULL, 'b032faf4-aebf-4848-984d-053eccc54f1f', 'spa', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0003-4000-8000-000000000003', 'iso639-3', NULL, '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'mil', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0004-4000-8000-000000000004', 'iso639-3', NULL, '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'zas', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0005-4000-8000-000000000005', 'iso639-3', NULL, '2f1e3d4c-5b6a-7890-1234-567890abcdef', 'poi', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0006-4000-8000-000000000006', 'iso639-3', NULL, '7a735df4-4f4e-4a03-b60e-eb7911152cf4', 'npi', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0007-4000-8000-000000000007', 'iso639-3', NULL, 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'por', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0008-4000-8000-000000000008', 'iso639-3', NULL, '6f800df3-05d2-455b-9a88-a077d1f111cc', 'tpi', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0009-4000-8000-000000000009', 'iso639-3', NULL, '57f410a6-a182-4126-b7ce-45e1280d0cfc', 'ind', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0010-4000-8000-000000000010', 'iso639-3', NULL, 'a1cb9ca9-8f6d-400b-a071-544a32ea1d82', 'por', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0011-4000-8000-000000000011', 'iso639-3', NULL, '155f40c3-cb64-4fdd-aaf7-a55acb42c755', 'fra', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0012-4000-8000-000000000012', 'iso639-3', NULL, '2e229bf3-06b7-40ce-b735-1499257c7fef', 'rus', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0013-4000-8000-000000000013', 'iso639-3', NULL, 'db0ae9dd-35f5-4f04-8f2e-e014c7fb0110', 'swh', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0014-4000-8000-000000000014', 'iso639-3', NULL, '3502e2a1-3cfd-45f7-8167-a9a67d42c76a', 'hin', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0015-4000-8000-000000000015', 'iso639-3', NULL, '8cde1960-ad33-41a5-bfdd-bcd92b00e4f3', 'arb', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0016-4000-8000-000000000016', 'iso639-3', NULL, '0d75d06f-2692-4127-b810-67dd64fa6eee', 'cmn', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0017-4000-8000-000000000017', 'iso639-3', NULL, '80293000-c406-4390-8de1-67b7ac11ce14', 'fas', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0018-4000-8000-000000000018', 'iso639-3', NULL, 'accfea8f-9b17-4bf7-96b2-56e81196267c', 'apd', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('b2b2b2b2-0019-4000-8000-000000000019', 'iso639-3', NULL, '0191cd2b-d151-4217-a7d4-19b2346c7b7e', 'bis', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL)
ON CONFLICT (languoid_id, unique_identifier) DO NOTHING;


--
-- Data for Name: languoid_property; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."languoid_property" ("id", "languoid_id", "key", "value", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('c3c3c3c3-0001-4000-8000-000000000001', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'macroareas', 'North America', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0002-4000-8000-000000000002', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'macroareas', 'Eurasia', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0003-4000-8000-000000000003', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'macroareas', 'North America', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0004-4000-8000-000000000004', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'macroareas', 'North America', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0005-4000-8000-000000000005', '2f1e3d4c-5b6a-7890-1234-567890abcdef', 'macroareas', 'North America', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0010-4000-8000-000000000010', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'fia_language_code', 'eng', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0011-4000-8000-000000000011', 'a1cb9ca9-8f6d-400b-a071-544a32ea1d82', 'fia_language_code', 'por', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0012-4000-8000-000000000012', '155f40c3-cb64-4fdd-aaf7-a55acb42c755', 'fia_language_code', 'fra', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0013-4000-8000-000000000013', '57f410a6-a182-4126-b7ce-45e1280d0cfc', 'fia_language_code', 'ind', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0014-4000-8000-000000000014', '2e229bf3-06b7-40ce-b735-1499257c7fef', 'fia_language_code', 'rus', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0015-4000-8000-000000000015', 'db0ae9dd-35f5-4f04-8f2e-e014c7fb0110', 'fia_language_code', 'swa', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0016-4000-8000-000000000016', '3502e2a1-3cfd-45f7-8167-a9a67d42c76a', 'fia_language_code', 'hin', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0017-4000-8000-000000000017', '8cde1960-ad33-41a5-bfdd-bcd92b00e4f3', 'fia_language_code', 'arb', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0018-4000-8000-000000000018', '0d75d06f-2692-4127-b810-67dd64fa6eee', 'fia_language_code', 'cmn', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0019-4000-8000-000000000019', '6f800df3-05d2-455b-9a88-a077d1f111cc', 'fia_language_code', 'tpi', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0020-4000-8000-000000000020', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'fia_language_code', 'spa', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0021-4000-8000-000000000021', '80293000-c406-4390-8de1-67b7ac11ce14', 'fia_language_code', 'fas', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0022-4000-8000-000000000022', 'accfea8f-9b17-4bf7-96b2-56e81196267c', 'fia_language_code', 'apd', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('c3c3c3c3-0023-4000-8000-000000000023', '0191cd2b-d151-4217-a7d4-19b2346c7b7e', 'fia_language_code', 'bis', true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL)
ON CONFLICT (languoid_id, key) DO NOTHING;


--
-- Data for Name: region; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."region" ("id", "parent_id", "name", "level", "geometry", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('d4d4d4d4-0001-4000-8000-000000000001', NULL, 'Mexico', 'nation', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('d4d4d4d4-0002-4000-8000-000000000002', 'd4d4d4d4-0001-4000-8000-000000000001', 'Oaxaca', 'subnational', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('d4d4d4d4-0003-4000-8000-000000000003', NULL, 'United States', 'nation', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('d4d4d4d4-0004-4000-8000-000000000004', NULL, 'Spain', 'nation', false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL);


--
-- Data for Name: region_source; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."region_source" ("id", "name", "version", "region_id", "unique_identifier", "url", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('e5e5e5e5-0001-4000-8000-000000000001', 'iso3166-1', NULL, 'd4d4d4d4-0001-4000-8000-000000000001', 'MX', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('e5e5e5e5-0002-4000-8000-000000000002', 'iso3166-1', NULL, 'd4d4d4d4-0003-4000-8000-000000000003', 'US', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('e5e5e5e5-0003-4000-8000-000000000003', 'iso3166-1', NULL, 'd4d4d4d4-0004-4000-8000-000000000004', 'ES', NULL, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL);


--
-- Data for Name: languoid_region; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."languoid_region" ("id", "languoid_id", "region_id", "majority", "official", "native", "active", "download_profiles", "created_at", "last_updated", "creator_id") VALUES
	('f6f6f6f6-0001-4000-8000-000000000001', 'fd3b1f58-0d2e-4798-b593-a51f7a37a2c1', 'd4d4d4d4-0003-4000-8000-000000000003', true, true, true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('f6f6f6f6-0002-4000-8000-000000000002', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'd4d4d4d4-0001-4000-8000-000000000001', true, true, false, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('f6f6f6f6-0003-4000-8000-000000000003', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'd4d4d4d4-0004-4000-8000-000000000004', true, true, true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('f6f6f6f6-0004-4000-8000-000000000004', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'd4d4d4d4-0002-4000-8000-000000000002', false, false, true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('f6f6f6f6-0005-4000-8000-000000000005', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'd4d4d4d4-0002-4000-8000-000000000002', false, false, true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL),
	('f6f6f6f6-0006-4000-8000-000000000006', '2f1e3d4c-5b6a-7890-1234-567890abcdef', 'd4d4d4d4-0001-4000-8000-000000000001', false, false, true, true, NULL, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', NULL);


--
-- Data for Name: asset; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset" ("id", "created_at", "last_updated", "name", "source_language_id", "images", "active") VALUES
	('b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:5 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('b538be82-1ff6-4131-9d1e-fa71fb398134', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:4 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('c29749a5-81af-4b64-b96d-4c89fe43ac3b', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:5 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:2 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('c3224b50-0deb-48e9-a1b2-4819eaf55789', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:3 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('eff8abcd-6179-4b14-aaaa-69ab054a99ae', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:3 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('1035d01f-4d59-4805-9d5c-5f40595398ab', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:4 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:3 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('17f6f122-e655-48fe-b02f-f09723a17d59', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:2 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('2d33323a-f98c-4642-ab8c-8225cd664ce1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('2fae8ba4-2a76-468f-a03c-34bfbd408c16', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:5 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('30be1d80-e1b5-4567-a063-093f30e1e8cb', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:4 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:5 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:4 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('43500d02-78c7-47be-897a-21d4302c61ba', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('4554299a-c42c-439a-903f-67c106c3b46e', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:3 (Zapoteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('5cfffc2f-e1d1-4418-a5d0-20988b322d35', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:2 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('a513e5d6-126b-4725-9029-ec08c7f55a0a', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', NULL, true),
	('13120777-7cef-4942-b2b8-37cd9f241c1b', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:2 (Mixteco)', 'b032faf4-aebf-4848-984d-053eccc54f1f', ARRAY['images/87aae958-21af-42c9-a42b-89ad96c9ab4b.jpg', 'images/b74d0e60-3fd7-4a17-ab14-5cdcbe79b789.jpg'], true);


--
-- Data for Name: asset_content_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset_content_link" ("id", "created_at", "last_updated", "asset_id", "audio", "text", "active") VALUES
	('27d88e43-af8e-4e6f-9308-18241530b31d', '2025-02-17 17:22:00.026634+00', '2025-02-17 17:22:00.026634+00', '30be1d80-e1b5-4567-a063-093f30e1e8cb', '["content/1_4_BES.mp3"]'::jsonb, 'Para que conozcas bien la verdad de aquellas cosas sobre las cuales te enseñaron. (BES)', true),
	('577fbc53-8a2f-4d4b-b5a1-1d3e7a22c469', '2025-02-17 17:27:09.120883+00', '2025-02-17 17:27:09.120883+00', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '["content/2_5_BES.mp3"]'::jsonb, 'Para ser puesto en la lista con María, su futura esposa, que estaba a punto de convertirse en madre. (BES)', true),
	('e9fb80b4-aa38-4be8-a156-42c3b232be4f', '2025-02-17 17:18:42.344526+00', '2025-02-17 17:18:42.344526+00', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '["content/2_3_BES.mp3"]'::jsonb, 'Y todos los hombres fueron contados, todos en su ciudad. (BES)', true),
	('061dbfe9-7eb5-4986-b56a-eb80eed57068', '2025-02-17 17:25:41.483798+00', '2025-02-17 17:25:41.483798+00', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', '["content/1_1_BES.mp3"]'::jsonb, 'Como varios intentos se han hecho para poner en orden el relato de aquellos eventos que tuvieron lugar entre nosotros, (BES)', true),
	('1a8916e4-4983-49ea-8326-87b6427ab671', '2025-02-17 17:22:54.526281+00', '2025-02-17 17:22:54.526281+00', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '["content/1_4_BES.mp3"]'::jsonb, 'Para que conozcas bien la verdad de aquellas cosas sobre las cuales te enseñaron. (BES)', true),
	('9b0b2606-fe28-4929-92ab-652c73f019a2', '2025-02-17 17:30:44.748282+00', '2025-02-17 17:30:44.748282+00', 'bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '["content/2_2_BES.mp3"]'::jsonb, 'Este primer censo, se hizo cuando Cirenio era el gobernante de Siria. (BES)', true),
	('d81273c4-35d6-422b-93bb-df3e2439270e', '2025-02-17 17:20:18.205476+00', '2025-02-17 17:20:18.205476+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '["content/1_2_BES.mp3"]'::jsonb, 'Tal como nos lo transmitieron por aquellos que lo vieron desde el principio y fueron predicadores de la palabra, (BES)', true),
	('d86c4299-6619-4e18-a34a-73bc49d9571d', '2025-02-17 17:26:05.626296+00', '2025-02-17 17:26:05.626296+00', 'b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '["content/2_1_BES.mp3"]'::jsonb, 'Ahora sucedió en aquellos días que salió una orden de César Augusto de empadronar a todo el mundo. (BES)', true),
	('fa561de2-582f-46a6-9858-0be0f346fa11', '2025-02-17 17:42:58.955427+00', '2025-02-17 17:42:58.955427+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', '["content/1_2_PDDPT.mp3"]'::jsonb, 'como nos las transmitieron los que desde el principio fueron testigos oculares y servidores de la Palabra, (PDDPT)', true),
	('ec71eea1-2df2-413f-8cc7-4436d0390727', '2025-02-17 17:24:06.892211+00', '2025-02-17 17:24:06.892211+00', '43500d02-78c7-47be-897a-21d4302c61ba', '["content/2_1_BES.mp3"]'::jsonb, 'Ahora sucedió en aquellos días que salió una orden de César Augusto de empadronar a todo el mundo. (BES)', true),
	('24d43b71-4833-4b6f-a329-30010d18ce61', '2025-02-17 17:21:35.462229+00', '2025-02-17 17:21:35.462229+00', '2fae8ba4-2a76-468f-a03c-34bfbd408c16', '["content/1_5_BES.mp3"]'::jsonb, 'En los días de Herodes, rey de Judea, había un sacerdote, llamado Zacarías, del orden de Abías; y él tenía una esposa de la familia de Aarón, y su nombre era Elisabet. (BES)', true),
	('27dcc501-b1c7-4a55-af55-3944164746bb', '2025-02-17 17:22:29.762721+00', '2025-02-17 17:22:29.762721+00', '3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '["content/2_5_BES.mp3"]'::jsonb, 'Para ser puesto en la lista con María, su futura esposa, que estaba a punto de convertirse en madre. (BES)', true),
	('57430f71-c501-4200-883b-1e19bad587e5', '2025-02-17 17:31:20.064058+00', '2025-02-17 17:31:20.064058+00', 'c3224b50-0deb-48e9-a1b2-4819eaf55789', '["content/2_3_BES.mp3"]'::jsonb, 'Y todos los hombres fueron contados, todos en su ciudad. (BES)', true),
	('695f46d1-ffc5-44f3-b922-ac8054f63d6b', '2025-02-17 17:19:37.596873+00', '2025-02-17 17:19:37.596873+00', '1035d01f-4d59-4805-9d5c-5f40595398ab', '["content/2_4_BES.mp3"]'::jsonb, 'Y subió José de Galilea, de la ciudad de Nazaret, a Judea, a Belén, la ciudad de David, porque era de la casa y familia de David, (BES)', true),
	('80219eb7-a115-4df9-81a8-3008dd0049eb', '2025-02-17 17:25:12.235762+00', '2025-02-17 17:25:12.235762+00', '5cfffc2f-e1d1-4418-a5d0-20988b322d35', '["content/2_2_BES.mp3"]'::jsonb, 'Este primer censo, se hizo cuando Cirenio era el gobernante de Siria. (BES)', true),
	('8bc5e6e8-0962-4825-8082-2ce7b3e82c19', '2025-02-17 17:24:29.654918+00', '2025-02-17 17:24:29.654918+00', '4554299a-c42c-439a-903f-67c106c3b46e', '["content/1_3_BES.mp3"]'::jsonb, 'Yo tambien excelentísimo Teófilo me pareció bien, después de haber hecho la investigación, con gran cuidado, de todas las cosas de los acontecimientos desde su origen, y poner los hechos por escrito. (BES)', true),
	('ff3df602-0339-48d2-aa31-d49310f25e84', '2025-02-17 17:31:03.539028+00', '2025-02-17 17:31:03.539028+00', 'c29749a5-81af-4b64-b96d-4c89fe43ac3b', '["content/1_5_BES.mp3"]'::jsonb, 'En los días de Herodes, rey de Judea, había un sacerdote, llamado Zacarías, del orden de Abías; y él tenía una esposa de la familia de Aarón, y su nombre era Elisabet. (BES)', true),
	('a8af02f5-f432-4cff-bc7c-f1626184af32', '2025-02-17 17:21:04.571513+00', '2025-02-17 17:21:04.571513+00', '2d33323a-f98c-4642-ab8c-8225cd664ce1', '["content/1_1_BES.mp3"]'::jsonb, 'Como varios intentos se han hecho para poner en orden el relato de aquellos eventos que tuvieron lugar entre nosotros, (BES)', true),
	('c7b3a8e0-38c5-4631-ba42-8b5b145b8962', '2025-02-17 17:31:43.169346+00', '2025-02-17 17:31:43.169346+00', 'eff8abcd-6179-4b14-aaaa-69ab054a99ae', '["content/1_3_BES.mp3"]'::jsonb, 'Yo tambien excelentísimo Teófilo me pareció bien, después de haber hecho la investigación, con gran cuidado, de todas las cosas de los acontecimientos desde su origen, y poner los hechos por escrito. (BES)', true),
	('dabee9fe-ce54-42c7-9ac9-ae4eaa7cfefe', '2025-02-17 17:28:43.564091+00', '2025-02-17 17:28:43.564091+00', 'b538be82-1ff6-4131-9d1e-fa71fb398134', '["content/2_4_BES.mp3"]'::jsonb, 'Y subió José de Galilea, de la ciudad de Nazaret, a Judea, a Belén, la ciudad de David, porque era de la casa y familia de David, (BES)', true),
    ('b085093e-30e5-4c64-b3e1-55b8f0617492', '2025-02-17 14:58:16.829421+00', '2025-02-17 14:58:16.829421+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', '["content/1_2_BES.mp3"]'::jsonb, 'Tal como nos lo transmitieron por aquellos que lo vieron desde el principio y fueron predicadores de la palabra, (BES)', true),
    ('c1f2a3b4-d5e6-4789-9abc-0def12345678', '2025-02-17 17:26:10.000000+00', '2025-02-17 17:26:10.000000+00', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', '["content/1_1_PDDPT.mp3"]'::jsonb, 'Puesto que muchos intentaron hacer una narración ordenada de los acontecimientos que han tenido cumplimiento entre nosotros, (PDDPT)', true);

-- Set source language only for the extra Lucas 1:1 Mixteco content to Universal
UPDATE "public"."asset_content_link"
SET "source_language_id" = 'ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2'
WHERE "id" = 'c1f2a3b4-d5e6-4789-9abc-0def12345678';

--
-- Data for Name: tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tag" ("id", "created_at", "last_updated", "key", "value", "active") VALUES
	('683e00e2-7136-4431-9e55-021234b8b6e9', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Libro', 'Lucas', true),
	('85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Capítulo', '1', true),
	('874d7520-e570-4c3f-9bc6-738b31b5e1e3', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Capítulo', '2', true),
	('6a84f765-4104-485b-8be8-d5858b8a4b44', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo', '1', true),
	('62397bd8-d56e-4c29-8388-2d399f7cd000', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo', '2', true),
	('e59fb3b5-77dd-4393-81ec-30b990964805', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo', '3', true),
	('fb07fe6f-d32e-4f87-b436-1f2e11d270cb', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo', '4', true),
	('ba5ef309-4a7a-450e-a43b-8cf2c2144dff', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo', '5', true),
	('24f1726f-b0ec-464f-a2c5-f9ec5d7ef4c9', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Libro', 'Génesis', true),
	('8cfb8b8f-ca52-4d74-8195-c884b9befc60', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Tipo', 'Vocabulario', true),
	('9d0a6ead-f14f-480d-83ff-5f784860b1a0', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Contenido', 'Creación', true);


--
-- Data for Name: asset_tag_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset_tag_link" ("asset_id", "tag_id", "active", "created_at", "last_modified") VALUES
	('a513e5d6-126b-4725-9029-ec08c7f55a0a', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('a513e5d6-126b-4725-9029-ec08c7f55a0a', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('a513e5d6-126b-4725-9029-ec08c7f55a0a', '6a84f765-4104-485b-8be8-d5858b8a4b44', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('13120777-7cef-4942-b2b8-37cd9f241c1b', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('13120777-7cef-4942-b2b8-37cd9f241c1b', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('13120777-7cef-4942-b2b8-37cd9f241c1b', '62397bd8-d56e-4c29-8388-2d399f7cd000', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('eff8abcd-6179-4b14-aaaa-69ab054a99ae', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('eff8abcd-6179-4b14-aaaa-69ab054a99ae', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('eff8abcd-6179-4b14-aaaa-69ab054a99ae', 'e59fb3b5-77dd-4393-81ec-30b990964805', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', 'fb07fe6f-d32e-4f87-b436-1f2e11d270cb', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2fae8ba4-2a76-468f-a03c-34bfbd408c16', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2fae8ba4-2a76-468f-a03c-34bfbd408c16', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2fae8ba4-2a76-468f-a03c-34bfbd408c16', 'ba5ef309-4a7a-450e-a43b-8cf2c2144dff', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '6a84f765-4104-485b-8be8-d5858b8a4b44', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('5cfffc2f-e1d1-4418-a5d0-20988b322d35', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('5cfffc2f-e1d1-4418-a5d0-20988b322d35', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('5cfffc2f-e1d1-4418-a5d0-20988b322d35', '62397bd8-d56e-4c29-8388-2d399f7cd000', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', 'e59fb3b5-77dd-4393-81ec-30b990964805', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b538be82-1ff6-4131-9d1e-fa71fb398134', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b538be82-1ff6-4131-9d1e-fa71fb398134', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b538be82-1ff6-4131-9d1e-fa71fb398134', 'fb07fe6f-d32e-4f87-b436-1f2e11d270cb', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', 'ba5ef309-4a7a-450e-a43b-8cf2c2144dff', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2d33323a-f98c-4642-ab8c-8225cd664ce1', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2d33323a-f98c-4642-ab8c-8225cd664ce1', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('2d33323a-f98c-4642-ab8c-8225cd664ce1', '6a84f765-4104-485b-8be8-d5858b8a4b44', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('17f6f122-e655-48fe-b02f-f09723a17d59', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('17f6f122-e655-48fe-b02f-f09723a17d59', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('17f6f122-e655-48fe-b02f-f09723a17d59', '62397bd8-d56e-4c29-8388-2d399f7cd000', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('4554299a-c42c-439a-903f-67c106c3b46e', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('4554299a-c42c-439a-903f-67c106c3b46e', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('4554299a-c42c-439a-903f-67c106c3b46e', 'e59fb3b5-77dd-4393-81ec-30b990964805', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('30be1d80-e1b5-4567-a063-093f30e1e8cb', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('30be1d80-e1b5-4567-a063-093f30e1e8cb', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('30be1d80-e1b5-4567-a063-093f30e1e8cb', 'fb07fe6f-d32e-4f87-b436-1f2e11d270cb', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c29749a5-81af-4b64-b96d-4c89fe43ac3b', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c29749a5-81af-4b64-b96d-4c89fe43ac3b', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c29749a5-81af-4b64-b96d-4c89fe43ac3b', 'ba5ef309-4a7a-450e-a43b-8cf2c2144dff', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('43500d02-78c7-47be-897a-21d4302c61ba', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('43500d02-78c7-47be-897a-21d4302c61ba', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('43500d02-78c7-47be-897a-21d4302c61ba', '6a84f765-4104-485b-8be8-d5858b8a4b44', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '62397bd8-d56e-4c29-8388-2d399f7cd000', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c3224b50-0deb-48e9-a1b2-4819eaf55789', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c3224b50-0deb-48e9-a1b2-4819eaf55789', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('c3224b50-0deb-48e9-a1b2-4819eaf55789', 'e59fb3b5-77dd-4393-81ec-30b990964805', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('1035d01f-4d59-4805-9d5c-5f40595398ab', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('1035d01f-4d59-4805-9d5c-5f40595398ab', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('1035d01f-4d59-4805-9d5c-5f40595398ab', 'fb07fe6f-d32e-4f87-b436-1f2e11d270cb', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00'),
	('b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', 'ba5ef309-4a7a-450e-a43b-8cf2c2144dff', true, '2025-02-18 23:05:28.079356+00', '2025-02-18 23:05:47.719917+00');


--
-- Data for Name: project; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."project" ("id", "created_at", "last_updated", "name", "description", "target_language_id", "creator_id", "download_profiles", "active") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas - Mixteco de Penasco', 'Traducción de Lucas al Mixteco de Penasco', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', ARRAY['c111d43b-5983-4342-9d9e-5fc8d09d77b9']::uuid[], true),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas - Zapoteco de Santiago', 'Traducción de Lucas al Zapoteco de Santiago', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'f2adf435-fd35-4927-8644-9b03785722b5', ARRAY['f2adf435-fd35-4927-8644-9b03785722b5']::uuid[], true);

-- Add source language via project_language_link (replaces the removed source_language_id column)
INSERT INTO "public"."project_language_link" ("project_id", "language_id", "languoid_id", "language_type", "active", "created_at", "last_updated") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'source', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'target', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'b032faf4-aebf-4848-984d-053eccc54f1f', 'source', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'target', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00');


--
-- Data for Name: quest; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest" ("id", "created_at", "last_updated", "name", "description", "project_id", "active") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1-5 (Mixteco)', 'Traducir Lucas 1:1-5 al Mixteco de Penasco', 'bace07b1-41de-4535-9c68-aa81683d9370', true),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1-5 (Mixteco)', 'Traducir Lucas 2:1-5 al Mixteco de Penasco', 'bace07b1-41de-4535-9c68-aa81683d9370', true),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1-5 (Zapoteco)', 'Traducir Lucas 2:1-5 al Zapoteco de Santiago', 'b819ba73-2274-468d-b18d-330b1ecf49b1', true);

-- Link Mixteco project to Universal language as a source via project_language_link
INSERT INTO "public"."project_language_link" ("project_id", "language_id", "languoid_id", "language_type", "active", "created_at", "last_updated") VALUES
  ('bace07b1-41de-4535-9c68-aa81683d9370', 'ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', 'ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', 'source', true, NOW(), NOW());


--
-- Data for Name: quest_asset_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest_asset_link" ("quest_id", "asset_id", "active", "created_at", "last_updated") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '13120777-7cef-4942-b2b8-37cd9f241c1b', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', 'eff8abcd-6179-4b14-aaaa-69ab054a99ae', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '2fae8ba4-2a76-468f-a03c-34bfbd408c16', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', 'b45f16fc-f7c9-403f-b559-1b4f6e66cafc', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '5cfffc2f-e1d1-4418-a5d0-20988b322d35', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', 'b538be82-1ff6-4131-9d1e-fa71fb398134', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '43500d02-78c7-47be-897a-21d4302c61ba', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'c3224b50-0deb-48e9-a1b2-4819eaf55789', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '1035d01f-4d59-4805-9d5c-5f40595398ab', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', '8bc88ad8-da4e-4fbb-ad06-50683ab7b2fb', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('02e4d72c-b6e1-43af-9b5b-949a25402560', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00');


--
-- Data for Name: quest_tag_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest_tag_link" ("quest_id", "tag_id", "active", "created_at", "last_updated") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '24f1726f-b0ec-464f-a2c5-f9ec5d7ef4c9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '8cfb8b8f-ca52-4d74-8195-c884b9befc60', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '9d0a6ead-f14f-480d-83ff-5f784860b1a0', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00');


--
-- Data for Name: translation; Type: TABLE DATA; Schema: public; Owner: postgres
-- Note: The translation table has been dropped in migration 20251008120000_modernize_schema_structure.sql
-- Translations are now represented as assets with asset_content_link records
--

-- Seed the translations as assets (matching the migration's translation-to-asset conversion)
INSERT INTO "public"."asset" ("id", "created_at", "last_updated", "name", "source_language_id", "project_id", "source_asset_id", "creator_id", "order_index", "download_profiles", "active") VALUES
	('1af7aa51-dc61-965f-e1d3-f8ebc6f5a1f0', '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00', NULL, '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'bace07b1-41de-4535-9c68-aa81683d9370', '13120777-7cef-4942-b2b8-37cd9f241c1b', 'fd56eb4e-0b54-4715-863c-f865aee0b16d', 0, ARRAY['fd56eb4e-0b54-4715-863c-f865aee0b16d']::uuid[], true),
	('38003a13-ec16-99cf-1973-c6bf864f63a8', '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00', NULL, '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'bace07b1-41de-4535-9c68-aa81683d9370', '13120777-7cef-4942-b2b8-37cd9f241c1b', '135167eb-7a93-4d90-8b00-85508facac71', 0, ARRAY['135167eb-7a93-4d90-8b00-85508facac71']::uuid[], true);

-- Create asset_content_link records for the translation content
INSERT INTO "public"."asset_content_link" ("id", "created_at", "last_updated", "asset_id", "source_language_id", "text", "audio", "download_profiles", "active") VALUES
	(gen_random_uuid(), '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00', '1af7aa51-dc61-965f-e1d3-f8ebc6f5a1f0', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'First translation', '["translations/6f1dcec7-50a5-40dc-aad6-8a291b3a6b86.m4a"]'::jsonb, ARRAY['fd56eb4e-0b54-4715-863c-f865aee0b16d']::uuid[], true),
	(gen_random_uuid(), '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00', '38003a13-ec16-99cf-1973-c6bf864f63a8', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Second translation', '["translations/432012bd-87f4-43db-be4e-8a7512b800a4.m4a"]'::jsonb, ARRAY['135167eb-7a93-4d90-8b00-85508facac71']::uuid[], true);

-- Create quest_asset_link records to maintain quest relationships
INSERT INTO "public"."quest_asset_link" ("quest_id", "asset_id", "visible", "download_profiles", "active", "created_at", "last_updated") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '1af7aa51-dc61-965f-e1d3-f8ebc6f5a1f0', true, ARRAY['fd56eb4e-0b54-4715-863c-f865aee0b16d']::uuid[], true, '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '38003a13-ec16-99cf-1973-c6bf864f63a8', true, ARRAY['135167eb-7a93-4d90-8b00-85508facac71']::uuid[], true, '2025-03-22 00:00:00+00', '2025-03-22 00:00:00+00');


-- Backfill: set asset.project_id for existing seeded assets using first linked quest
UPDATE "public"."asset" a
SET "project_id" = src.project_id
FROM (
  SELECT DISTINCT ON (qal.asset_id)
    qal.asset_id,
    q.project_id
  FROM "public"."quest_asset_link" qal
  JOIN "public"."quest" q ON q.id = qal.quest_id
  WHERE qal.active = true
  ORDER BY qal.asset_id, qal.created_at NULLS LAST
) AS src
WHERE a.id = src.asset_id
  AND a."project_id" IS NULL;


--
-- Data for Name: vote; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vote" ("id", "created_at", "last_updated", "asset_id", "polarity", "comment", "creator_id", "active") VALUES
	('102a2706-b365-1070-8abc-49a5eaef2dc4', '2025-02-19 23:02:06+00', '2025-02-19 23:03:28+00', 'dcfeb818-0dd8-5648-c60d-936401a04113', 'up', '', 'd6c72afa-6fa4-49ec-be21-e3c642c02576', false),
	('f4e12b53-c293-7a4b-cae9-ffd469c1230f', '2025-02-19 23:03:28+00', '2025-02-19 23:04:06+00', 'dcfeb818-0dd8-5648-c60d-936401a04113', 'down', '', 'd6c72afa-6fa4-49ec-be21-e3c642c02576', false),
	('a55e157e-2eb2-d2f7-36e7-42338d5687f5', '2025-02-20 21:56:51+00', '2025-02-20 21:56:51+00', 'b5085d8a-e4e1-aee5-27eb-51f462b7bf9b', 'up', '', '8f3a6249-9269-435d-9bf7-f60ae81ee27a', true),
	('d6eed4b4-d5cc-5639-8a6b-faf9df510fe3', '2025-02-22 04:56:36+00', '2025-02-22 04:57:16+00', '1af7aa51-dc61-965f-e1d3-f8ebc6f5a1f0', 'up', '', 'd6c72afa-6fa4-49ec-be21-e3c642c02576', false),
	('0cef258d-8e6d-c451-9856-c108af8e1f5d', '2025-03-07 16:26:25+00', '2025-03-07 16:26:25+00', 'cdb730b8-0fd3-3153-e963-3831666e82a2', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('101fe1f2-0adf-58ce-3a0c-ea4d138b4777', '2025-03-07 20:55:00+00', '2025-03-07 20:55:00+00', 'da0085b7-55f1-b0e1-3107-784086e49fd3', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('ef2cb471-3763-4da6-a1b7-bf7aa7ab82fc', '2025-02-19 18:08:34+00', '2025-03-11 19:09:07+00', '3061b4b0-cc57-1592-bbc5-6e7eadfa8e76', 'up', '', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', false),
	('45f82e4c-0df4-cb68-1066-d21855940b01', '2025-03-08 20:59:55+00', '2025-03-11 19:09:07+00', '3061b4b0-cc57-1592-bbc5-6e7eadfa8e76', 'down', '', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', true),
	('6653cd29-90f7-8ba3-37e3-2731165e3b01', '2025-03-13 17:22:10+00', '2025-03-13 17:22:11+00', '46d41af5-bf93-ceb0-f633-b423bb3d841b', 'down', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', false),
	('a5ed54e4-0a00-8760-61c2-815ce3fbafac', '2025-03-13 17:22:23+00', '2025-03-13 17:22:51+00', '80bcfb5a-568f-9bf7-d167-41feafb56cc2', 'down', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', false),
	('7875d54c-a043-7d4f-68f2-b9675e0f56f0', '2025-03-13 17:22:09+00', '2025-03-13 17:22:51+00', '80bcfb5a-568f-9bf7-d167-41feafb56cc2', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('c723e3e9-b395-bf6a-0514-11540433d2d1', '2025-03-13 17:22:15+00', '2025-03-13 18:11:26+00', '1a03e5c5-7942-dbb5-2a3c-120025b496db', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', false),
	('703cc15f-7913-5aff-7f15-b323b6763443', '2025-03-13 18:11:26+00', '2025-03-13 18:11:26+00', '1a03e5c5-7942-dbb5-2a3c-120025b496db', 'down', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('c4981bd2-7cf3-50eb-ce2c-f5e7116bfa19', '2025-03-13 17:22:11+00', '2025-03-13 18:11:29+00', '46d41af5-bf93-ceb0-f633-b423bb3d841b', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', false),
	('647595ea-52f6-a36d-7f97-890fd8f98168', '2025-03-14 16:03:59+00', '2025-03-14 16:03:59+00', '5c2b1d74-e715-dfea-663e-ed7f038ab9df', 'up', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('2f359fb4-2a9d-b450-7993-4b0e46949343', '2025-02-19 18:07:57+00', '2025-02-19 18:08:02+00', '3061b4b0-cc57-1592-bbc5-6e7eadfa8e76', 'down', '', 'f2adf435-fd35-4927-8644-9b03785722b5', false),
	('e21209a8-e126-f157-f6dd-a9e350a55da9', '2025-02-19 18:07:47+00', '2025-02-19 18:08:05+00', '3061b4b0-cc57-1592-bbc5-6e7eadfa8e76', 'up', '', 'f2adf435-fd35-4927-8644-9b03785722b5', true);

--
-- Data for Name: profile_project_link; Type: TABLE DATA; Schema: public; Owner: postgres
-- Create profile_project_link records for project creators
-- download_profiles contains OTHER active members (not self) - set empty here, triggers handle it
--

INSERT INTO "public"."profile_project_link" ("profile_id", "project_id", "membership", "active", "created_at", "last_updated") VALUES
	('c111d43b-5983-4342-9d9e-5fc8d09d77b9', 'bace07b1-41de-4535-9c68-aa81683d9370', 'owner', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
	('f2adf435-fd35-4927-8644-9b03785722b5', 'b819ba73-2274-468d-b18d-330b1ecf49b1', 'owner', true, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00')
ON CONFLICT ("profile_id", "project_id") DO UPDATE SET
	"membership" = EXCLUDED."membership",
	"active" = EXCLUDED."active",
	"last_updated" = EXCLUDED."last_updated";

-- Temporarily set search_path so unqualified names inside functions resolve to public
SELECT set_config('search_path', 'public', true);
-- NOTE: Closure rebuild functions commented out temporarily as they reference the now-dropped translation table
-- These functions need to be updated in a follow-up migration to work with the new asset-centric model
-- SELECT * FROM public.rebuild_all_project_closures();
-- SELECT * FROM public.rebuild_all_quest_closures();
-- Restore to empty search_path (local to this script execution)
SELECT set_config('search_path', '', true);

--
-- PostgreSQL database dump complete
--

-- RESET ALL;
