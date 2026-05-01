-- Migration: Disable all language array refresh triggers
-- Purpose: These triggers recompute source_language_ids and target_language_ids
--          on quest_closure and project_closure. The recomputation does a full
--          project-wide scan (quest → quest_asset_link → asset → acl) which
--          exceeds the 8s authenticated role statement_timeout for large
--          projects, causing every upload to fail with HTTP 500 (57014) in a
--          permanent retry loop. The language array fields are not consumed by
--          any client code, so disabling all of these triggers is safe.

-- asset_content_link triggers
ALTER TABLE public.asset_content_link DISABLE TRIGGER trg_acl_refresh_languages_ins;
ALTER TABLE public.asset_content_link DISABLE TRIGGER trg_acl_refresh_languages_upd;
ALTER TABLE public.asset_content_link DISABLE TRIGGER trg_acl_refresh_languages_del;

-- asset triggers
ALTER TABLE public.asset DISABLE TRIGGER trg_asset_refresh_languages_ins;
ALTER TABLE public.asset DISABLE TRIGGER trg_asset_refresh_languages_upd;

-- translation triggers
ALTER TABLE public.translation DISABLE TRIGGER trg_translation_refresh_languages_ins;
ALTER TABLE public.translation DISABLE TRIGGER trg_translation_refresh_languages_upd;
ALTER TABLE public.translation DISABLE TRIGGER trg_translation_refresh_languages_del;

-- closure-level triggers (fire when closure ids change, call the same rescan)
ALTER TABLE public.quest_closure DISABLE TRIGGER trg_update_quest_closure_languages;
ALTER TABLE public.project_closure DISABLE TRIGGER trg_update_project_closure_languages;
