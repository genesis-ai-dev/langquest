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

INSERT INTO "public"."profile" ("id", "created_at", "last_updated", "username", "password", "ui_language_id", "active", "terms_accepted", "terms_version") VALUES
	('7c8863d2-fcba-4f72-9d48-2e15949dbb0d', '2025-01-30 04:16:03.397675+00', '2025-01-30 04:16:03.397675+00', 'Dodira', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('72a0344c-c687-42a2-9e03-64b287105ec1', '2025-01-31 23:35:12.788215+00', '2025-01-31 23:35:12.788215+00', 'Wallaby', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('44a2a0c1-4bb1-4c4d-9121-5b0da6676142', '2025-02-01 03:43:50.964698+00', '2025-02-01 03:43:50.964698+00', 'Flea', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('557ef72c-4e78-44c1-bb44-e75e8e4743ea', '2025-02-03 19:02:05.290686+00', '2025-02-03 19:02:05.290686+00', 'Caterpillar', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('c2115199-ee01-4006-8af9-35774d770146', '2025-02-03 21:20:39.038605+00', '2025-02-03 21:20:39.038605+00', 'Lemur', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('23f77011-86f0-41fa-99ba-34d62c058143', '2025-02-07 00:06:13.841558+00', '2025-02-07 00:06:13.841558+00', 'Viper', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('77acb538-4e38-4d72-935c-47d554a687ab', '2025-02-07 04:54:38.554155+00', '2025-02-07 04:54:38.554155+00', 'Nightingale', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('a42f180f-c949-4a2d-a1cf-27cea1799f21', '2025-02-07 23:48:40.924084+00', '2025-02-07 23:48:40.924084+00', 'Badger', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('c6930ab1-b6bd-42d1-b086-a81a79aa27d7', '2025-02-11 23:58:30.254704+00', '2025-02-11 23:58:30.254704+00', 'Worm', NULL, '7c37870b-7d52-4589-934f-576f03781263', true, false, NULL),
	('528d0cb1-6622-40c6-b3bf-98540969c67e', '2025-02-12 06:22:56.357054+00', '2025-02-12 06:22:56.357054+00', 'Capybara', NULL, '7c37870b-7d52-4589-934f-576f03781263', true, false, NULL),
	('f326de7c-fb02-4da0-adf0-4c8c65fa4d03', '2025-02-12 06:55:36.019876+00', '2025-02-12 06:55:36.019876+00', 'Giraffe', NULL, '7c37870b-7d52-4589-934f-576f03781263', true, false, NULL),
	('a7fa1539-ec76-443c-a851-c30197397d54', '2025-02-12 18:36:26.56749+00', '2025-02-12 18:36:26.56749+00', 'Flea', NULL, '7c37870b-7d52-4589-934f-576f03781263', true, false, NULL),
	('0c4e1afd-88ad-475f-b72d-681721f8d560', '2025-02-12 23:35:52.011919+00', '2025-02-12 23:35:52.011919+00', 'Walrus', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('8f3a6249-9269-435d-9bf7-f60ae81ee27a', '2025-02-14 19:13:01.89991+00', '2025-02-14 19:13:01.89991+00', 'ryder', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '2025-02-15 04:48:16.854153+00', '2025-02-15 04:48:16.854153+00', 'Goose', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('fd56eb4e-0b54-4715-863c-f865aee0b16d', '2024-12-28 21:40:32.521063+00', '2024-12-28 21:40:32.521063+00', 'Caleb', NULL, NULL, true, false, NULL),
	('7fd7be49-fa89-4b78-a93d-e728fe810110', '2024-12-28 23:31:36.246915+00', '2024-12-28 23:31:36.246915+00', 'Milhouse', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('135167eb-7a93-4d90-8b00-85508facac71', '2025-01-08 17:42:10.974563+00', '2025-01-08 17:42:10.974563+00', 'Ryder', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('d5a37d36-6376-4e34-9005-22ce17ec2c36', '2025-01-08 20:33:05.900419+00', '2025-01-08 20:33:05.900419+00', 'randallt', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('f2adf435-fd35-4927-8644-9b03785722b5', '2025-02-19 18:06:29.610079+00', '2025-02-19 18:06:29.610079+00', 'Keean2', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('59b05eb2-d3b8-4292-975a-45f9c614e58f', '2025-03-10 20:49:17.040094+00', '2025-03-10 20:49:17.040094+00', 'ryder10032025_2', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, false, NULL),
	('c111d43b-5983-4342-9d9e-5fc8d09d77b9', '2025-01-19 00:13:31.935664+00', '2025-01-19 00:13:31.935664+00', 'Keean', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, true, '1.0'),
	('ff6e4bb4-3840-4168-917a-d29e09145958', '2025-03-06 18:20:56.649327+00', '2025-03-06 18:20:56.649327+00', 'BenScholtens', NULL, 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true, true, '1.0');


--
-- Data for Name: language; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."language" ("id", "created_at", "last_updated", "native_name", "english_name", "iso639_3", "ui_ready", "creator_id", "active") VALUES
	('bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'English', 'English', 'eng', true, NULL, true),
	('7c37870b-7d52-4589-934f-576f03781263', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Español', 'Spanish', 'spa', true, NULL, true),
	('9e3f8bd9-c2e5-4f5a-b98d-123456789012', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Tu''un Savi', 'Mixteco de Penasco', 'mil', false, NULL, true),
	('4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Diidxazá', 'Zapoteco de Santiago', 'zas', false, NULL, true),
	('2f1e3d4c-5b6a-7890-1234-567890abcdef', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Nuntajɨ̃yi', 'Popoluca', 'poi', false, NULL, true),
	('ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', '2025-03-13 00:31:36.819037+00', '2025-03-13 00:31:36.819037+00', 'Universal', 'Universal', 'unv', false, NULL, true);


--
-- Data for Name: asset; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset" ("id", "created_at", "last_updated", "name", "source_language_id", "images", "active") VALUES
	('b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:5 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('b538be82-1ff6-4131-9d1e-fa71fb398134', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:4 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('c29749a5-81af-4b64-b96d-4c89fe43ac3b', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:5 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:2 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('c3224b50-0deb-48e9-a1b2-4819eaf55789', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:3 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('eff8abcd-6179-4b14-aaaa-69ab054a99ae', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:3 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('1035d01f-4d59-4805-9d5c-5f40595398ab', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:4 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:3 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('17f6f122-e655-48fe-b02f-f09723a17d59', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:2 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('2d33323a-f98c-4642-ab8c-8225cd664ce1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('2fae8ba4-2a76-468f-a03c-34bfbd408c16', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:5 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('30be1d80-e1b5-4567-a063-093f30e1e8cb', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:4 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:5 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:4 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('43500d02-78c7-47be-897a-21d4302c61ba', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('4554299a-c42c-439a-903f-67c106c3b46e', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:3 (Zapoteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('5cfffc2f-e1d1-4418-a5d0-20988b322d35', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:2 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('a513e5d6-126b-4725-9029-ec08c7f55a0a', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', NULL, true),
	('13120777-7cef-4942-b2b8-37cd9f241c1b', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:2 (Mixteco)', '7c37870b-7d52-4589-934f-576f03781263', '["87aae958-21af-42c9-a42b-89ad96c9ab4b", "b74d0e60-3fd7-4a17-ab14-5cdcbe79b789"]', true),
	('8bc88ad8-da4e-4fbb-ad06-50683ab7b2fb', '2025-03-13 05:01:08.103+00', '2025-03-13 05:01:10.125841+00', 'Sun', 'ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', '["images/1741842051676-rajiv-bajaj-i4QIqfcTkN8-unsplash.jpg"]', true),
	('02e4d72c-b6e1-43af-9b5b-949a25402560', '2025-03-13 16:36:08.239+00', '2025-03-13 16:36:08.569954+00', 'Test', '7c37870b-7d52-4589-934f-576f03781263', '["images/1741883767533-2cfc9df55d1e90dad2126afc9380b424.jpeg"]', true);


--
-- Data for Name: asset_content_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset_content_link" ("id", "created_at", "last_updated", "asset_id", "audio_id", "text", "active") VALUES
	('27d88e43-af8e-4e6f-9308-18241530b31d', '2025-02-17 17:22:00.026634+00', '2025-02-17 17:22:00.026634+00', '30be1d80-e1b5-4567-a063-093f30e1e8cb', '2dceeb0c-698b-4aee-a375-7d7a4eb8e1af_LUK_1_4_BES.mp3', 'Para que conozcas bien la verdad de aquellas cosas sobre las cuales te enseñaron. (BES)', true),
	('577fbc53-8a2f-4d4b-b5a1-1d3e7a22c469', '2025-02-17 17:27:09.120883+00', '2025-02-17 17:27:09.120883+00', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', '14d27d20-f099-4b6d-ab4e-8947903833b2_LUK_2_5_BES.mp3', 'Para ser puesto en la lista con María, su futura esposa, que estaba a punto de convertirse en madre. (BES)', true),
	('e9fb80b4-aa38-4be8-a156-42c3b232be4f', '2025-02-17 17:18:42.344526+00', '2025-02-17 17:18:42.344526+00', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', 'c143456d-d16a-4d72-a449-ab374ad941dc_LUK_2_3_BES.mp3', 'Y todos los hombres fueron contados, todos en su ciudad. (BES)', true),
	('061dbfe9-7eb5-4986-b56a-eb80eed57068', '2025-02-17 17:25:41.483798+00', '2025-02-17 17:25:41.483798+00', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', 'e5b453d7-e0b5-4e69-8c5c-7c828cde49a9_LUK_1_1_BES.mp3', 'Como varios intentos se han hecho para poner en orden el relato de aquellos eventos que tuvieron lugar entre nosotros, (BES)', true),
	('1a8916e4-4983-49ea-8326-87b6427ab671', '2025-02-17 17:22:54.526281+00', '2025-02-17 17:22:54.526281+00', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '2dceeb0c-698b-4aee-a375-7d7a4eb8e1af_LUK_1_4_BES.mp3', 'Para que conozcas bien la verdad de aquellas cosas sobre las cuales te enseñaron. (BES)', true),
	('9b0b2606-fe28-4929-92ab-652c73f019a2', '2025-02-17 17:30:44.748282+00', '2025-02-17 17:30:44.748282+00', 'bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', 'f9e927cd-7a05-49d0-ba81-e8d6ee91dd99_LUK_2_2_BES.mp3', 'Este primer censo, se hizo cuando Cirenio era el gobernante de Siria. (BES)', true),
	('d81273c4-35d6-422b-93bb-df3e2439270e', '2025-02-17 17:20:18.205476+00', '2025-02-17 17:20:18.205476+00', '17f6f122-e655-48fe-b02f-f09723a17d59', 'ec4737e7-b417-4205-8b9d-ada2622dcb56_LUK_1_2_BES.mp3', 'Tal como nos lo transmitieron por aquellos que lo vieron desde el principio y fueron predicadores de la palabra, (BES)', true),
	('d86c4299-6619-4e18-a34a-73bc49d9571d', '2025-02-17 17:26:05.626296+00', '2025-02-17 17:26:05.626296+00', 'b45f16fc-f7c9-403f-b559-1b4f6e66cafc', '0438f11a-f43f-445e-a875-929918a277d3_LUK_2_1_BES.mp3', 'Ahora sucedió en aquellos días que salió una orden de César Augusto de empadronar a todo el mundo. (BES)', true),
	('fa561de2-582f-46a6-9858-0be0f346fa11', '2025-02-17 17:42:58.955427+00', '2025-02-17 17:42:58.955427+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', 'ec4737e7-b417-4205-8b9d-ada2622dcb56_LUK_1_2_BES.mp3', 'como nos las transmitieron los que desde el principio fueron testigos oculares y servidores de la Palabra, (PDDPT)', true),
	('ec71eea1-2df2-413f-8cc7-4436d0390727', '2025-02-17 17:24:06.892211+00', '2025-02-17 17:24:06.892211+00', '43500d02-78c7-47be-897a-21d4302c61ba', '0438f11a-f43f-445e-a875-929918a277d3_LUK_2_1_BES.mp3', 'Ahora sucedió en aquellos días que salió una orden de César Augusto de empadronar a todo el mundo. (BES)', true),
	('24d43b71-4833-4b6f-a329-30010d18ce61', '2025-02-17 17:21:35.462229+00', '2025-02-17 17:21:35.462229+00', '2fae8ba4-2a76-468f-a03c-34bfbd408c16', '71783af3-8f32-4afd-b006-2c36f60351b8_LUK_1_5_BES.mp3', 'En los días de Herodes, rey de Judea, había un sacerdote, llamado Zacarías, del orden de Abías; y él tenía una esposa de la familia de Aarón, y su nombre era Elisabet. (BES)', true),
	('27dcc501-b1c7-4a55-af55-3944164746bb', '2025-02-17 17:22:29.762721+00', '2025-02-17 17:22:29.762721+00', '3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '14d27d20-f099-4b6d-ab4e-8947903833b2_LUK_2_5_BES.mp3', 'Para ser puesto en la lista con María, su futura esposa, que estaba a punto de convertirse en madre. (BES)', true),
	('57430f71-c501-4200-883b-1e19bad587e5', '2025-02-17 17:31:20.064058+00', '2025-02-17 17:31:20.064058+00', 'c3224b50-0deb-48e9-a1b2-4819eaf55789', 'c143456d-d16a-4d72-a449-ab374ad941dc_LUK_2_3_BES.mp3', 'Y todos los hombres fueron contados, todos en su ciudad. (BES)', true),
	('695f46d1-ffc5-44f3-b922-ac8054f63d6b', '2025-02-17 17:19:37.596873+00', '2025-02-17 17:19:37.596873+00', '1035d01f-4d59-4805-9d5c-5f40595398ab', 'f1f6a2c1-f6d8-4c68-86e4-96b532d91b6d_LUK_2_4_BES.mp3', 'Y subió José de Galilea, de la ciudad de Nazaret, a Judea, a Belén, la ciudad de David, porque era de la casa y familia de David, (BES)', true),
	('80219eb7-a115-4df9-81a8-3008dd0049eb', '2025-02-17 17:25:12.235762+00', '2025-02-17 17:25:12.235762+00', '5cfffc2f-e1d1-4418-a5d0-20988b322d35', 'f9e927cd-7a05-49d0-ba81-e8d6ee91dd99_LUK_2_2_BES.mp3', 'Este primer censo, se hizo cuando Cirenio era el gobernante de Siria. (BES)', true),
	('8bc5e6e8-0962-4825-8082-2ce7b3e82c19', '2025-02-17 17:24:29.654918+00', '2025-02-17 17:24:29.654918+00', '4554299a-c42c-439a-903f-67c106c3b46e', '5cd960ce-8b0e-49de-9c56-884994c75cf3_LUK_1_3_BES.mp3', 'Yo tambien excelentísimo Teófilo me pareció bien, después de haber hecho la investigación, con gran cuidado, de todas las cosas de los acontecimientos desde su origen, y poner los hechos por escrito. (BES)', true),
	('ff3df602-0339-48d2-aa31-d49310f25e84', '2025-02-17 17:31:03.539028+00', '2025-02-17 17:31:03.539028+00', 'c29749a5-81af-4b64-b96d-4c89fe43ac3b', '71783af3-8f32-4afd-b006-2c36f60351b8_LUK_1_5_BES.mp3', 'En los días de Herodes, rey de Judea, había un sacerdote, llamado Zacarías, del orden de Abías; y él tenía una esposa de la familia de Aarón, y su nombre era Elisabet. (BES)', true),
	('a8af02f5-f432-4cff-bc7c-f1626184af32', '2025-02-17 17:21:04.571513+00', '2025-02-17 17:21:04.571513+00', '2d33323a-f98c-4642-ab8c-8225cd664ce1', 'e5b453d7-e0b5-4e69-8c5c-7c828cde49a9_LUK_1_1_BES.mp3', 'Como varios intentos se han hecho para poner en orden el relato de aquellos eventos que tuvieron lugar entre nosotros, (BES)', true),
	('c7b3a8e0-38c5-4631-ba42-8b5b145b8962', '2025-02-17 17:31:43.169346+00', '2025-02-17 17:31:43.169346+00', 'eff8abcd-6179-4b14-aaaa-69ab054a99ae', '5cd960ce-8b0e-49de-9c56-884994c75cf3_LUK_1_3_BES.mp3', 'Yo tambien excelentísimo Teófilo me pareció bien, después de haber hecho la investigación, con gran cuidado, de todas las cosas de los acontecimientos desde su origen, y poner los hechos por escrito. (BES)', true),
	('dabee9fe-ce54-42c7-9ac9-ae4eaa7cfefe', '2025-02-17 17:28:43.564091+00', '2025-02-17 17:28:43.564091+00', 'b538be82-1ff6-4131-9d1e-fa71fb398134', 'f1f6a2c1-f6d8-4c68-86e4-96b532d91b6d_LUK_2_4_BES.mp3', 'Y subió José de Galilea, de la ciudad de Nazaret, a Judea, a Belén, la ciudad de David, porque era de la casa y familia de David, (BES)', true),
	('b085093e-30e5-4c64-b3e1-55b8f0617492', '2025-02-17 14:58:16.829421+00', '2025-02-17 14:58:16.829421+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', 'ed880ff0-2f4e-436a-94b8-91c9590a06a5_LUK_1_2_PDDPT.m4a', 'Tal como nos lo transmitieron por aquellos que lo vieron desde el principio y fueron predicadores de la palabra, (BES)', true);


--
-- Data for Name: asset_download; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset_download" ("profile_id", "asset_id", "active", "created_at", "last_updated") VALUES
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'b538be82-1ff6-4131-9d1e-fa71fb398134', false, '2025-02-22 04:59:45+00', '2025-03-03 21:46:52+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '13120777-7cef-4942-b2b8-37cd9f241c1b', false, '2025-02-22 05:10:13+00', '2025-03-11 01:23:27+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '2fae8ba4-2a76-468f-a03c-34bfbd408c16', false, '2025-02-22 03:44:46+00', '2025-03-11 01:23:27+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', false, '2025-02-22 05:10:13+00', '2025-03-11 01:23:27+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'eff8abcd-6179-4b14-aaaa-69ab054a99ae', true, '2025-02-22 04:38:47+00', '2025-03-13 06:48:45+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', false, '2025-02-22 04:59:45+00', '2025-02-28 20:53:37+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', false, '2025-02-22 04:59:45+00', '2025-02-28 20:53:37+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '5cfffc2f-e1d1-4418-a5d0-20988b322d35', false, '2025-02-22 04:59:45+00', '2025-02-28 20:53:37+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'b45f16fc-f7c9-403f-b559-1b4f6e66cafc', false, '2025-02-22 01:56:01+00', '2025-02-28 20:53:37+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', true, '2025-02-24 15:15:32+00', '2025-03-13 06:49:04+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '17f6f122-e655-48fe-b02f-f09723a17d59', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '2d33323a-f98c-4642-ab8c-8225cd664ce1', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '30be1d80-e1b5-4567-a063-093f30e1e8cb', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '4554299a-c42c-439a-903f-67c106c3b46e', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'c29749a5-81af-4b64-b96d-4c89fe43ac3b', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '1035d01f-4d59-4805-9d5c-5f40595398ab', false, '2025-02-27 05:32:22+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '43500d02-78c7-47be-897a-21d4302c61ba', false, '2025-02-27 05:32:22+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', false, '2025-02-21 18:36:09+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', false, '2025-02-21 18:36:32+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'c3224b50-0deb-48e9-a1b2-4819eaf55789', false, '2025-02-22 04:25:08+00', '2025-02-28 18:51:38+00');


--
-- Data for Name: tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tag" ("id", "created_at", "last_updated", "name", "active") VALUES
	('683e00e2-7136-4431-9e55-021234b8b6e9', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Libro:Lucas', true),
	('85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Capítulo:1', true),
	('874d7520-e570-4c3f-9bc6-738b31b5e1e3', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Capítulo:2', true),
	('6a84f765-4104-485b-8be8-d5858b8a4b44', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo:1', true),
	('62397bd8-d56e-4c29-8388-2d399f7cd000', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo:2', true),
	('e59fb3b5-77dd-4393-81ec-30b990964805', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo:3', true),
	('fb07fe6f-d32e-4f87-b436-1f2e11d270cb', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo:4', true),
	('ba5ef309-4a7a-450e-a43b-8cf2c2144dff', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Versículo:5', true),
	('24f1726f-b0ec-464f-a2c5-f9ec5d7ef4c9', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Libro:Génesis', true),
	('8cfb8b8f-ca52-4d74-8195-c884b9befc60', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Tipo:Vocabulario', true),
	('9d0a6ead-f14f-480d-83ff-5f784860b1a0', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Contenido:Creación', true);


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

INSERT INTO "public"."project" ("id", "created_at", "last_updated", "name", "description", "source_language_id", "target_language_id", "active") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas - Mixteco de Penasco', 'Traducción de Lucas al Mixteco de Penasco', '7c37870b-7d52-4589-934f-576f03781263', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', true),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas - Zapoteco de Santiago', 'Traducción de Lucas al Zapoteco de Santiago', '7c37870b-7d52-4589-934f-576f03781263', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', true),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Vocabulario Génesis - Popoluca', 'Vocabulario visual de Génesis en Popoluca', '7c37870b-7d52-4589-934f-576f03781263', '2f1e3d4c-5b6a-7890-1234-567890abcdef', true),
	('719fd888-3fc7-4186-b13e-afef455e1c88', '2025-03-13 03:24:29.654254+00', '2025-03-13 03:24:29.654254+00', 'Nature Images', 'Generic images of natural phenomena', 'ceae62bf-d109-4eb9-95e3-3fd0d2ba0ab2', 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd', true);


--
-- Data for Name: project_download; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."project_download" ("profile_id", "project_id", "active", "created_at", "last_updated") VALUES
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '97d398d9-4737-44f1-a9da-fe3f988e193a', false, '2025-02-25 23:53:45+00', '2025-02-26 05:46:36+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'b819ba73-2274-468d-b18d-330b1ecf49b1', false, '2025-02-27 05:32:22+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'bace07b1-41de-4535-9c68-aa81683d9370', false, '2025-02-22 05:10:13+00', '2025-02-28 20:53:37+00');


--
-- Data for Name: quest; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest" ("id", "created_at", "last_updated", "name", "description", "project_id", "active") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1-5 (Mixteco)', 'Traducir Lucas 1:1-5 al Mixteco de Penasco', 'bace07b1-41de-4535-9c68-aa81683d9370', true),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1-5 (Mixteco)', 'Traducir Lucas 2:1-5 al Mixteco de Penasco', 'bace07b1-41de-4535-9c68-aa81683d9370', true),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 1:1-5 (Zapoteco)', 'Traducir Lucas 1:1-5 al Zapoteco de Santiago', 'b819ba73-2274-468d-b18d-330b1ecf49b1', true),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Lucas 2:1-5 (Zapoteco)', 'Traducir Lucas 2:1-5 al Zapoteco de Santiago', 'b819ba73-2274-468d-b18d-330b1ecf49b1', true),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', 'Vocabulario de Creación', 'Traducir palabras clave de Génesis 1 al Popoluca', '97d398d9-4737-44f1-a9da-fe3f988e193a', true),
	('afe6443a-86b4-472b-b815-09d2a2d5d5f2', '2025-03-13 03:48:46.581258+00', '2025-03-13 03:48:46.581258+00', 'Weather', 'Weather-related images', '719fd888-3fc7-4186-b13e-afef455e1c88', true);


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
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '2d33323a-f98c-4642-ab8c-8225cd664ce1', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '17f6f122-e655-48fe-b02f-f09723a17d59', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '4554299a-c42c-439a-903f-67c106c3b46e', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '30be1d80-e1b5-4567-a063-093f30e1e8cb', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', 'c29749a5-81af-4b64-b96d-4c89fe43ac3b', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '43500d02-78c7-47be-897a-21d4302c61ba', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'bdb5a215-6ecc-4492-b31e-eb6f7d756aa2', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'c3224b50-0deb-48e9-a1b2-4819eaf55789', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '1035d01f-4d59-4805-9d5c-5f40595398ab', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', 'b51d0e7b-afb9-4d56-a6e7-1dd769d5deee', true, '2025-02-18 23:13:58.153943+00', '2025-02-18 23:14:21.758276+00');


--
-- Data for Name: quest_download; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest_download" ("profile_id", "quest_id", "active", "created_at", "last_updated") VALUES
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'd8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', false, '2025-02-25 23:53:45+00', '2025-02-26 05:46:36+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', false, '2025-02-27 05:32:22+00', '2025-02-28 18:51:38+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'b819ba73-2274-468d-b18d-330b1ecf49b1', false, '2025-02-22 05:08:44+00', '2025-02-28 20:53:37+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', '97d398d9-4737-44f1-a9da-fe3f988e193a', false, '2025-02-27 05:32:22+00', '2025-03-03 21:45:44+00'),
	('d6c72afa-6fa4-49ec-be21-e3c642c02576', 'bace07b1-41de-4535-9c68-aa81683d9370', false, '2025-02-22 05:10:13+00', '2025-03-11 01:23:27+00');


--
-- Data for Name: quest_tag_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."quest_tag_link" ("quest_id", "tag_id", "active", "created_at", "last_updated") VALUES
	('bace07b1-41de-4535-9c68-aa81683d9370', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('bace07b1-41de-4535-9c68-aa81683d9370', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('b819ba73-2274-468d-b18d-330b1ecf49b1', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('97d398d9-4737-44f1-a9da-fe3f988e193a', '85e2355b-7d57-47b5-bdfb-8fe46e8b1f41', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '683e00e2-7136-4431-9e55-021234b8b6e9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('c6d7e8f9-0a1b-2c3d-4e5f-6789abcdef01', '874d7520-e570-4c3f-9bc6-738b31b5e1e3', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '24f1726f-b0ec-464f-a2c5-f9ec5d7ef4c9', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '8cfb8b8f-ca52-4d74-8195-c884b9befc60', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00'),
	('d8e9f0a1-b2c3-4d5e-6f78-90abcdef1234', '9d0a6ead-f14f-480d-83ff-5f784860b1a0', true, '2025-02-18 23:14:39.01534+00', '2025-02-18 23:14:55.200026+00');


--
-- Data for Name: translation; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."translation" ("id", "created_at", "last_updated", "asset_id", "target_language_id", "text", "audio", "creator_id", "active") VALUES
	('1af7aa51-dc61-965f-e1d3-f8ebc6f5a1f0', '2025-01-29 23:51:22+00', '2025-01-29 23:51:22+00', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Test', NULL, 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true),
	('38003a13-ec16-99cf-1973-c6bf864f63a8', '2025-01-08 20:38:45+00', '2025-01-08 20:38:45+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Randall''s translation', NULL, 'd5a37d36-6376-4e34-9005-22ce17ec2c36', true),
	('5c2b1d74-e715-dfea-663e-ed7f038ab9df', '2025-01-18 23:13:20+00', '2025-01-18 23:13:20+00', '43500d02-78c7-47be-897a-21d4302c61ba', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Testing 1/18', NULL, 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true),
	('b5085d8a-e4e1-aee5-27eb-51f462b7bf9b', '2025-01-08 20:35:32+00', '2025-01-08 20:35:32+00', '30be1d80-e1b5-4567-a063-093f30e1e8cb', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Testing', NULL, 'd5a37d36-6376-4e34-9005-22ce17ec2c36', true),
	('cdb730b8-0fd3-3153-e963-3831666e82a2', '2025-01-08 20:39:35+00', '2025-01-08 20:39:35+00', '3ca42ab6-7d76-4ccd-b7ed-ed17b39a4333', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Test', NULL, 'd5a37d36-6376-4e34-9005-22ce17ec2c36', true),
	('d1ffcd12-9925-1f1b-98e4-8f0adb664bc3', '2024-12-28 23:33:16+00', '2024-12-28 23:33:16+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Caleb''s translation', NULL, 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true),
	('fd523deb-4e0a-faf5-5647-d9e1b54392e9', '2025-01-08 17:43:32+00', '2025-01-08 17:43:32+00', '30be1d80-e1b5-4567-a063-093f30e1e8cb', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Hello', NULL, '135167eb-7a93-4d90-8b00-85508facac71', true),
	('dcfeb818-0dd8-5648-c60d-936401a04113', '2024-12-28 23:32:18+00', '2024-12-28 23:32:18+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Milhouse''s translation', NULL, '7fd7be49-fa89-4b78-a93d-e728fe810110', true),
	('3061b4b0-cc57-1592-bbc5-6e7eadfa8e76', '2025-02-05 04:08:40+00', '2025-02-05 04:08:40+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Pause test', '6f1dcec7-50a5-40dc-aad6-8a291b3a6b86.m4a', 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true),
	('da0085b7-55f1-b0e1-3107-784086e49fd3', '2025-02-03 00:06:15+00', '2025-02-03 00:06:15+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'Keean', 'd1cac465-4884-4cfc-9381-e5b171875a8e.m4a', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', true),
	('40d0e9ea-5a54-9788-ac2d-4ec2591fb25c', '2025-02-02 23:45:27+00', '2025-02-02 23:45:27+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '2f1e3d4c-5b6a-7890-1234-567890abcdef', 'Test audio recording - two parts with pause between', 'd7659e4c-b00e-4ebc-870d-1ffcd10ac041.m4a', 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true),
	('b01a3b52-1461-3026-b1ea-ba9f4c445b9f', '2025-03-10 21:14:52+00', '2025-03-10 21:14:52+00', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'This is Ryder''s test-only translation', '', '8f3a6249-9269-435d-9bf7-f60ae81ee27a', true),
	('32385bec-9f14-4241-9229-4ce4420b020c', '2025-02-05 19:30:12+00', '2025-02-05 19:30:12+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'No audio test with RLS active', NULL, 'c2115199-ee01-4006-8af9-35774d770146', true),
	('5aa9dfee-e528-91b4-fcbc-50b88ecd4535', '2025-03-14 01:20:35+00', '2025-03-14 01:20:35+00', 'a513e5d6-126b-4725-9029-ec08c7f55a0a', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Keean 3', '139b208c-6445-4d1c-9707-39b497928323.m4a', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', true),
	('3876115f-ae0b-df0b-97ec-139fca0d4b54', '2025-03-14 19:39:33+00', '2025-03-14 19:39:33+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'this is a test', '', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('327b2677-638f-7373-31ef-6c17975ae73c', '2025-03-08 19:59:23+00', '2025-03-08 19:59:23+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '', '2744ef00-0701-427a-99ee-618bf35cf507.m4a', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', true),
	('78d08720-e28e-717d-e8c0-72fcff6544e7', '2025-03-08 19:43:26+00', '2025-03-08 19:43:26+00', '13120777-7cef-4942-b2b8-37cd9f241c1b', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '', '19a3b71a-3591-4fe2-b212-b0ffa757be26.m4a', 'c111d43b-5983-4342-9d9e-5fc8d09d77b9', true),
	('1a03e5c5-7942-dbb5-2a3c-120025b496db', '2025-03-07 16:15:33+00', '2025-03-07 16:15:33+00', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '', 'dc2321d4-d99b-4890-9063-8148f26334b7.m4a', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('46d41af5-bf93-ceb0-f633-b423bb3d841b', '2025-03-07 16:10:15+00', '2025-03-07 16:10:15+00', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', '', '2f5b3943-c4ef-4779-98ef-b60f185693a8.m4a', 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('80bcfb5a-568f-9bf7-d167-41feafb56cc2', '2025-03-07 16:09:14+00', '2025-03-07 16:09:14+00', '0ae4c34e-2a21-4b3f-ab30-d927cc58ce49', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'This is a test from Ben', NULL, 'ff6e4bb4-3840-4168-917a-d29e09145958', true),
	('23d9984f-a1f6-e754-cc5e-85d080742201', '2025-02-22 04:58:09+00', '2025-02-22 04:58:09+00', '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3', '9e3f8bd9-c2e5-4f5a-b98d-123456789012', 'Text audio test', '25bc9e7b-d5a0-4991-9b31-de9d6c560190.m4a', 'd6c72afa-6fa4-49ec-be21-e3c642c02576', true),
	('29d0bf31-cbdc-57b3-e7bb-4af32120a4cb', '2025-02-20 22:25:23+00', '2025-02-20 22:25:23+00', '30be1d80-e1b5-4567-a063-093f30e1e8cb', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '', '952f1f3c-e909-43e7-b287-07f0a5675c28.m4a', '8f3a6249-9269-435d-9bf7-f60ae81ee27a', true),
	('edf5d415-b64a-16dd-d32d-96686202a2da', '2025-02-14 19:16:54+00', '2025-02-14 19:16:54+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '', '432012bd-87f4-43db-be4e-8a7512b800a4.m4a', '8f3a6249-9269-435d-9bf7-f60ae81ee27a', true),
	('3552fdfd-bd79-1295-ee07-386e4a961734', '2025-02-14 19:16:42+00', '2025-02-14 19:16:42+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', '', 'f4c304a6-e0c1-4c91-bbd6-073c2d6c7ec7.m4a', '8f3a6249-9269-435d-9bf7-f60ae81ee27a', true),
	('d0700730-bc1d-d6f9-6520-514982f81fb5', '2025-02-05 19:15:33+00', '2025-02-05 19:15:33+00', '17f6f122-e655-48fe-b02f-f09723a17d59', '4a8b7c6d-5e4f-3a2b-1c9d-987654321098', 'RLS test', '05ca2661-fa46-4203-b096-e7bdf77e07e6.m4a', 'c2115199-ee01-4006-8af9-35774d770146', true);


--
-- Data for Name: vote; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vote" ("id", "created_at", "last_updated", "translation_id", "polarity", "comment", "creator_id", "active") VALUES
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
-- PostgreSQL database dump complete
--

RESET ALL;
