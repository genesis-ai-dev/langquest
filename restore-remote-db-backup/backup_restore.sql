-- ⚠️ DEPRECATED: This file has been replaced with a complete recovery system
-- 
-- Please use the new recovery scripts instead:
-- 
-- 1. RECOVERY_QUICK_REFERENCE.md - Quick start guide
-- 2. DATABASE_RECOVERY_GUIDE.md  - Complete documentation  
-- 3. validate_extraction.sql     - Validation script
-- 4. extract_recent_data.sql     - Data extraction script
-- 5. restore_extracted_data.sql  - Data restoration script
-- 6. RECOVERY_CHECKLIST.md       - Step-by-step checklist
--
-- The original query below had syntax errors and has been superseded.
-- Do not use this file for recovery operations.
-- 
-- ===========================================================================
-- ORIGINAL FILE (DO NOT USE):
-- ===========================================================================

-- Example for one table
SELECT 'auth.schema_migrations' AS table_name, *
FROM auth.schema_migrations
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.instances', *
FROM auth.instances
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.users', *
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.schema_migrations', *
FROM auth.schema_migrations
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.instances', *
FROM auth.instances
WHERE created_at >= NOW() - INTERVAL '2 days'
UNION ALL
SELECT 'auth.users', *
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.refresh_tokens', *
FROM auth.refresh_tokens
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.migrations', *
FROM storage.migrations
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.objects', *
FROM storage.objects
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.prefixes', *
FROM storage.prefixes
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.buckets', *
FROM storage.buckets
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.buckets_analytics', *
FROM storage.buckets_analytics
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.oauth_authorizations', *
FROM auth.oauth_authorizations
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.project_language_link', *
FROM public.project_language_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.oauth_consents', *
FROM auth.oauth_consents
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.oauth_clients', *
FROM auth.oauth_clients
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.map_project', *
FROM public.map_project
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.map_quest', *
FROM public.map_quest
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.map_asset', *
FROM public.map_asset
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.map_acl', *
FROM public.map_acl
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.clone_job', *
FROM public.clone_job
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.project_rollup_progress', *
FROM public.project_rollup_progress
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.languoid', *
FROM public.languoid
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.languoid_alias', *
FROM public.languoid_alias
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.languoid_source', *
FROM public.languoid_source
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.languoid_property', *
FROM public.languoid_property
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.region', *
FROM public.region
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.region_alias', *
FROM public.region_alias
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.region_source', *
FROM public.region_source
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.region_property', *
FROM public.region_property
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.languoid_region', *
FROM public.languoid_region
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.flag', *
FROM public.flag
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.reports', *
FROM public.reports
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.blocked_users', *
FROM public.blocked_users
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.blocked_content', *
FROM public.blocked_content
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.http_request_queue', *
FROM public.http_request_queue
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public._http_response', *
FROM public._http_response
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.notification', *
FROM public.notification
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.subscription', *
FROM public.subscription
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.sso_providers', *
FROM auth.sso_providers
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.sessions', *
FROM auth.sessions
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.saml_relay_states', *
FROM auth.saml_relay_states
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.sso_domains', *
FROM auth.sso_domains
WHERE created_at >= NOW() - INTERVAL '2 days'

SELECT 'auth.mfa_amr_claims', *
FROM auth.mfa_amr_claims
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.saml_providers', *
FROM auth.saml_providers
WHERE created_at >= NOW() - INTERVAL '2 days'

  UNION ALL
SELECT 'auth.flow_state', *
FROM auth.flow_state
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.identities', *
FROM auth.identities
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.one_time_tokens', *
FROM auth.one_time_tokens
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.mfa_factors', *
FROM auth.mfa_factors
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'auth.mfa_challenges', *
FROM auth.mfa_challenges
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.profile_project_link', *
FROM public.profile_project_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.s3_multipart_uploads', *
FROM storage.s3_multipart_uploads
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'storage.s3_multipart_uploads_parts', *
FROM storage.s3_multipart_uploads_parts
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.invite', *
FROM public.invite
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.profile', *
FROM public.profile
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.quest_tag_link', *
FROM public.quest_tag_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.asset_tag_link', *
FROM public.asset_tag_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.project', *
FROM public.project
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.asset_content_link', *
FROM public.asset_content_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.quest', *
FROM public.quest
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.quest_asset_link', *
FROM public.quest_asset_link
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.tag', *
FROM public.tag
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.vote', *
FROM public.vote
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.language', *
FROM public.language
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.quest_closure', *
FROM public.quest_closure
WHERE created_at >= NOW() - INTERVAL '2 days'

UNION ALL
SELECT 'public.project_closure', *
FROM public.project_closure
WHERE created_at >= NOW() - INTERVAL '2 days'


UNION ALL
SELECT 'public.asset', *
FROM public.asset
WHERE created_at >= NOW() - INTERVAL '2 days'

;