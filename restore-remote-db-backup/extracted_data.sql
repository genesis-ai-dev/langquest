Output format is unaligned.
Field separator is "".
BEGIN
CREATE FUNCTION
COMMIT
-- Extracted Data from Last 2 Days
-- Generated:  :CURRENT_TIMESTAMP
-- Database Recovery Script

BEGIN;

-- ====================
-- Auth Schema Tables
-- ====================

-- auth.users
-- auth.identities
-- auth.sessions






-- auth.refresh_tokens
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6345, '2pc4nxybqixx', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 20:30:57.910132+00', '2025-10-20 21:29:57.945033+00', '7n4rvnu73n6h', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6346, 'edthvrstm5fq', 'fd56eb4e-0b54-4715-863c-f865aee0b16d', true, '2025-10-20 20:53:38.511051+00', '2025-10-20 21:51:40.326213+00', 'bjidxwykeeyy', 'ca0f9ce9-3167-4c85-929a-33879a64d488');

INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6348, 'kmadelzqqwif', '15b12804-2db6-4da1-81b6-b8114e23f93b', false, '2025-10-20 21:29:57.950234+00', '2025-10-20 21:29:57.950234+00', '2pc4nxybqixx', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6349, 'co7nbtacy2wi', 'fd56eb4e-0b54-4715-863c-f865aee0b16d', false, '2025-10-20 21:51:40.331953+00', '2025-10-20 21:51:40.331953+00', 'edthvrstm5fq', 'ca0f9ce9-3167-4c85-929a-33879a64d488');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6343, '7n4rvnu73n6h', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 19:31:57.844787+00', '2025-10-20 20:30:57.903411+00', 'a56kbn2vqvak', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');

INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6300, 'o6n2p7hmvf4c', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-19 01:58:52.69898+00', '2025-10-19 02:57:56.306879+00', 'riinfi3rplw5', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6301, 'at54s6ss6kmb', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-19 02:57:56.315258+00', '2025-10-19 03:56:56.373716+00', 'o6n2p7hmvf4c', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6302, 'w65em4h4okla', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-19 03:56:56.379749+00', '2025-10-19 04:55:56.213945+00', 'at54s6ss6kmb', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6303, 'uda6z6ekvtbp', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-19 04:55:56.220617+00', '2025-10-19 05:54:56.880752+00', 'w65em4h4okla', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6304, 'x53yx6s4icmv', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-19 05:54:56.896972+00', '2025-10-20 02:49:23.089829+00', 'uda6z6ekvtbp', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6305, 'lizsibfdauzw', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 02:49:23.1032+00', '2025-10-20 03:47:57.167549+00', 'x53yx6s4icmv', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6306, '7emh6ya5flio', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 03:47:57.179246+00', '2025-10-20 04:46:57.169162+00', 'lizsibfdauzw', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6308, 'vab26scqkpyq', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 04:46:57.176273+00', '2025-10-20 05:45:57.295333+00', '7emh6ya5flio', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6310, 'aoqt2k6ruje4', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 05:45:57.302017+00', '2025-10-20 06:44:57.302215+00', 'vab26scqkpyq', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6312, 't6smqgziccfy', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 06:44:57.308463+00', '2025-10-20 07:43:57.315936+00', 'aoqt2k6ruje4', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6314, 'tiieqbzkcevf', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 07:43:57.322309+00', '2025-10-20 08:42:57.372084+00', 't6smqgziccfy', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6316, 'a3lwi5lu75lc', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 08:42:57.37474+00', '2025-10-20 09:41:57.511682+00', 'tiieqbzkcevf', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6318, 'tqdzabzii4vp', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 09:41:57.516298+00', '2025-10-20 10:40:57.406119+00', 'a3lwi5lu75lc', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6320, '3xvowp3uf7jg', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 10:40:57.4081+00', '2025-10-20 11:39:57.3961+00', 'tqdzabzii4vp', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6322, 'ybgz6jndyd4d', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 11:39:57.399403+00', '2025-10-20 12:38:57.586424+00', '3xvowp3uf7jg', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6324, 'lfs2psudwbpv', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 12:38:57.587285+00', '2025-10-20 13:37:57.880079+00', 'ybgz6jndyd4d', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6326, 'bu54aq6v6jtz', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 13:37:57.880878+00', '2025-10-20 14:36:57.690289+00', 'lfs2psudwbpv', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');




INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6328, 'dmu747t7nklt', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 14:36:57.691028+00', '2025-10-20 15:35:57.547069+00', 'bu54aq6v6jtz', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6334, 'bgnndyq7varp', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 15:35:57.55092+00', '2025-10-20 16:34:57.897334+00', 'dmu747t7nklt', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6336, 'jmfvhbudg2tf', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 16:34:57.902807+00', '2025-10-20 17:33:57.889391+00', 'bgnndyq7varp', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6339, '5pbph3whu35n', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 17:33:57.893539+00', '2025-10-20 18:32:57.692739+00', 'jmfvhbudg2tf', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6341, 'a56kbn2vqvak', '15b12804-2db6-4da1-81b6-b8114e23f93b', true, '2025-10-20 18:32:57.696213+00', '2025-10-20 19:31:57.838164+00', '5pbph3whu35n', '3ed18159-d9ad-4b0d-9d9f-8a10d5fc1e21');
-- auth.mfa_factors
-- auth.mfa_challenges
-- auth.one_time_tokens
-- auth.flow_state

-- ====================
-- Storage Schema Tables
-- ====================

-- storage.objects
-- storage.buckets
-- storage.s3_multipart_uploads
-- storage.s3_multipart_uploads_parts

-- ====================
-- Public Schema Tables
-- ====================

-- public.language
-- public.profile
-- public.languoid (may have self-references via parent_id)
-- Note: These will be inserted with deferred constraints
-- public.languoid_alias
-- public.languoid_source
-- public.languoid_property
-- public.region (may have self-references via parent_id)
-- public.region_alias
-- public.region_source
-- public.region_property
-- public.languoid_region
-- public.project


-- public.project_language_link
-- public.profile_project_link
INSERT INTO public.profile_project_link (profile_id, project_id, active, membership, created_at, last_updated) VALUES ('fd56eb4e-0b54-4715-863c-f865aee0b16d', 'd395e711-a674-440f-a720-c3cb8f45df18', true, 'owner', '2025-10-20 04:51:35+00', '2025-10-20 04:51:35+00');
-- public.project_closure
-- Note: Skipping - computed table that will be regenerated automatically
-- public.project_rollup_progress
-- Note: Skipping - tracking table that will be regenerated automatically
-- public.invite
-- public.quest




-- public.quest_closure
-- Note: Skipping - computed table that will be regenerated automatically
-- public.asset (may have self-references via source_asset_id)
-- Ordered by created_at to handle dependencies






-- public.asset_content_link






-- public.quest_asset_link






-- public.tag
-- public.quest_tag_link
-- public.asset_tag_link
-- public.vote
-- public.flag
-- public.reports
-- public.blocked_users
-- public.blocked_content
-- public.map_project
-- Note: Skipping - metadata table that will be regenerated automatically
-- public.map_quest
-- Note: Skipping - metadata table that will be regenerated automatically
-- public.map_asset
-- Note: Skipping - metadata table that will be regenerated automatically
-- public.map_acl
-- Note: Skipping - metadata table that will be regenerated automatically
-- public.clone_job

COMMIT;

-- Extraction complete
DROP FUNCTION
