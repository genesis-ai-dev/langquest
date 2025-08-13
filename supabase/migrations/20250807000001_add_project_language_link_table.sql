-- Create project_language_link table to support multiple source languages and one target language per project
CREATE TABLE public.project_language_link (
    project_id uuid NOT NULL,
    language_id uuid NOT NULL,
    language_type text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_updated timestamp with time zone NOT NULL DEFAULT now(),
    download_profiles uuid[] DEFAULT '{}'::uuid[],
    ingest_batch_id uuid,
    
    -- Constraints
    CONSTRAINT project_language_link_pkey PRIMARY KEY (project_id, language_id, language_type),
    CONSTRAINT project_language_link_language_type_check CHECK (language_type IN ('source', 'target')),
    CONSTRAINT project_language_link_project_id_fkey FOREIGN KEY (project_id) 
        REFERENCES public.project(id) ON DELETE CASCADE,
    CONSTRAINT project_language_link_language_id_fkey FOREIGN KEY (language_id) 
        REFERENCES public.language(id) ON DELETE RESTRICT
);

-- Create unique constraint to ensure only one target language per project
CREATE UNIQUE INDEX project_language_link_single_target 
    ON public.project_language_link (project_id) 
    WHERE language_type = 'target' AND active = true;

-- Create index for efficient queries
CREATE INDEX project_language_link_project_id_idx ON public.project_language_link(project_id);
CREATE INDEX project_language_link_language_id_idx ON public.project_language_link(language_id);
CREATE INDEX project_language_link_type_idx ON public.project_language_link(language_type);
CREATE INDEX project_language_link_active_idx ON public.project_language_link(active) WHERE active = true;

-- Enable Row Level Security
ALTER TABLE public.project_language_link ENABLE ROW LEVEL SECURITY;

-- Grant permissions (anon can only select)
GRANT SELECT ON TABLE public.project_language_link TO anon;

GRANT DELETE ON TABLE public.project_language_link TO authenticated;
GRANT INSERT ON TABLE public.project_language_link TO authenticated;
GRANT REFERENCES ON TABLE public.project_language_link TO authenticated;
GRANT SELECT ON TABLE public.project_language_link TO authenticated;
GRANT TRIGGER ON TABLE public.project_language_link TO authenticated;
GRANT TRUNCATE ON TABLE public.project_language_link TO authenticated;
GRANT UPDATE ON TABLE public.project_language_link TO authenticated;

GRANT DELETE ON TABLE public.project_language_link TO service_role;
GRANT INSERT ON TABLE public.project_language_link TO service_role;
GRANT REFERENCES ON TABLE public.project_language_link TO service_role;
GRANT SELECT ON TABLE public.project_language_link TO service_role;
GRANT TRIGGER ON TABLE public.project_language_link TO service_role;
GRANT TRUNCATE ON TABLE public.project_language_link TO service_role;
GRANT UPDATE ON TABLE public.project_language_link TO service_role;

-- RLS Policies

-- Read access: Anyone can read project language links
CREATE POLICY "project_language_link_select_policy"
ON public.project_language_link
FOR SELECT
TO public
USING (true);

-- Insert access: Project owners and members can add language links
CREATE POLICY "project_language_link_insert_policy"
ON public.project_language_link
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profile_project_link ppl
        WHERE ppl.project_id = project_language_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
        AND ppl.membership IN ('owner', 'member')
    )
);

-- Update access: Project owners and members can update language links
CREATE POLICY "project_language_link_update_policy"
ON public.project_language_link
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profile_project_link ppl
        WHERE ppl.project_id = project_language_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
        AND ppl.membership IN ('owner', 'member')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profile_project_link ppl
        WHERE ppl.project_id = project_language_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
        AND ppl.membership IN ('owner', 'member')
    )
);

-- Delete access: Only project owners can delete language links
CREATE POLICY "project_language_link_delete_policy"
ON public.project_language_link
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profile_project_link ppl
        WHERE ppl.project_id = project_language_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
        AND ppl.membership = 'owner'
    )
);

-- Function to migrate existing source/target language data to the new link table
CREATE OR REPLACE FUNCTION migrate_project_languages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert source languages
    INSERT INTO public.project_language_link (
        project_id,
        language_id,
        language_type,
        download_profiles
    )
    SELECT 
        p.id,
        p.source_language_id,
        'source',
        p.download_profiles
    FROM public.project p
    WHERE p.source_language_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Insert target languages
    INSERT INTO public.project_language_link (
        project_id,
        language_id,
        language_type,
        download_profiles
    )
    SELECT 
        p.id,
        p.target_language_id,
        'target',
        p.download_profiles
    FROM public.project p
    WHERE p.target_language_id IS NOT NULL
    ON CONFLICT DO NOTHING;
END;
$$;

-- Run the migration
SELECT migrate_project_languages();

-- Add to PowerSync publication
ALTER PUBLICATION powersync ADD TABLE ONLY public.project_language_link;

-- Note: Uniqueness is already enforced by the composite primary key (project_id, language_id, language_type)

-- Ensure project_closure has download_profiles column
ALTER TABLE public.project_closure
ADD COLUMN IF NOT EXISTS download_profiles uuid[] DEFAULT '{}'::uuid[];

-- Backfill download_profiles on project_closure from project table for existing rows
UPDATE public.project_closure pc
SET download_profiles = p.download_profiles
FROM public.project p
WHERE p.id = pc.project_id
  AND (pc.download_profiles IS NULL OR pc.download_profiles = '{}'::uuid[]);

-- Add explicit language separation to closure tables
ALTER TABLE public.project_closure
  ADD COLUMN IF NOT EXISTS source_language_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_language_ids jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.quest_closure
  ADD COLUMN IF NOT EXISTS source_language_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_language_ids jsonb DEFAULT '[]'::jsonb;

-- Add source_language_id to asset_content_link and backfill from asset
ALTER TABLE public.asset_content_link
  ADD COLUMN IF NOT EXISTS source_language_id uuid;

ALTER TABLE public.asset_content_link
  ADD CONSTRAINT asset_content_link_source_language_id_fkey
  FOREIGN KEY (source_language_id) REFERENCES public.language(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS asset_content_link_source_language_id_idx
  ON public.asset_content_link(source_language_id);

CREATE INDEX IF NOT EXISTS asset_content_link_asset_source_language_idx
  ON public.asset_content_link(asset_id, source_language_id);

-- Backfill new column from legacy asset.source_language_id
UPDATE public.asset_content_link acl
SET source_language_id = a.source_language_id
FROM public.asset a
WHERE a.id = acl.asset_id
  AND acl.source_language_id IS NULL;

-- Add ingest_batch_id to core tables (batch-safe triggers will skip when set)
ALTER TABLE public.quest_tag_link ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.asset ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.asset_tag_link ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.tag ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.asset_content_link ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.quest ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.quest_asset_link ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
-- Also required for triggers below
ALTER TABLE public.translation ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.vote ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;
ALTER TABLE public.language ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;

-- Update last_updated timestamp automatically
CREATE OR REPLACE FUNCTION update_project_language_link_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_project_language_link_timestamp_trigger
BEFORE UPDATE ON public.project_language_link
FOR EACH ROW
EXECUTE FUNCTION update_project_language_link_timestamp();

-- Utility: recompute quest_closure language arrays
CREATE OR REPLACE FUNCTION public.update_quest_language_arrays(quest_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qc quest_closure%ROWTYPE;
BEGIN
  SELECT * INTO qc FROM quest_closure WHERE quest_id = quest_id_param;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Recompute source languages from asset_content_link entries in this quest
  UPDATE quest_closure
  SET source_language_ids = (
    SELECT COALESCE(
      jsonb_agg(DISTINCT acl.source_language_id::text) FILTER (WHERE acl.source_language_id IS NOT NULL),
      '[]'::jsonb
    )
    FROM asset_content_link acl
    WHERE acl.id = ANY(ARRAY(SELECT (jsonb_array_elements_text(qc.asset_content_link_ids))::uuid))
  ),
  target_language_ids = (
    SELECT COALESCE(
      jsonb_agg(DISTINCT t.target_language_id::text) FILTER (WHERE t.target_language_id IS NOT NULL),
      '[]'::jsonb
    )
    FROM translation t
    WHERE t.id = ANY(ARRAY(SELECT (jsonb_array_elements_text(qc.translation_ids))::uuid))
  ),
  last_updated = now()
  WHERE quest_id = quest_id_param;
END;
$$;

-- Utility: recompute project_closure language arrays
CREATE OR REPLACE FUNCTION public.update_project_language_arrays(project_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pc project_closure%ROWTYPE;
BEGIN
  SELECT * INTO pc FROM project_closure WHERE project_id = project_id_param;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Recompute source languages from asset_content_link entries in this project
  UPDATE project_closure
  SET source_language_ids = (
    SELECT COALESCE(
      jsonb_agg(DISTINCT acl.source_language_id::text) FILTER (WHERE acl.source_language_id IS NOT NULL),
      '[]'::jsonb
    )
    FROM asset_content_link acl
    WHERE acl.id = ANY(ARRAY(SELECT (jsonb_array_elements_text(pc.asset_content_link_ids))::uuid))
  ),
  target_language_ids = (
    SELECT COALESCE(
      jsonb_agg(DISTINCT t.target_language_id::text) FILTER (WHERE t.target_language_id IS NOT NULL),
      '[]'::jsonb
    )
    FROM translation t
    WHERE t.id = ANY(ARRAY(SELECT (jsonb_array_elements_text(pc.translation_ids))::uuid))
  ),
  last_updated = now()
  WHERE project_id = project_id_param;
END;
$$;

-- Helper: refresh languages for an asset across related quests and project
CREATE OR REPLACE FUNCTION public.refresh_languages_for_asset(asset_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid uuid;
  pid uuid;
BEGIN
  -- Recompute for each quest that links to this asset
  FOR qid IN
    SELECT DISTINCT qal.quest_id
    FROM quest_asset_link qal
    WHERE qal.asset_id = asset_id_param AND qal.active = true AND qal.visible = true
  LOOP
    PERFORM public.update_quest_language_arrays(qid);

    -- Also recompute for the parent project of this quest
    SELECT q.project_id INTO pid FROM quest q WHERE q.id = qid;
    IF pid IS NOT NULL THEN
      PERFORM public.update_project_language_arrays(pid);
    END IF;
  END LOOP;
END;
$$;

-- Triggers on quest_closure and project_closure to recompute language arrays when their ids change
CREATE OR REPLACE FUNCTION public.trigger_update_quest_closure_languages()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.update_quest_language_arrays(NEW.quest_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_update_quest_closure_languages ON public.quest_closure;
CREATE TRIGGER trg_update_quest_closure_languages
AFTER UPDATE OF asset_content_link_ids, translation_ids ON public.quest_closure
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_quest_closure_languages();

CREATE OR REPLACE FUNCTION public.trigger_update_project_closure_languages()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.update_project_language_arrays(NEW.project_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_update_project_closure_languages ON public.project_closure;
CREATE TRIGGER trg_update_project_closure_languages
AFTER UPDATE OF asset_content_link_ids, translation_ids ON public.project_closure
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_project_closure_languages();

-- Triggers for asset_content_link: recompute quest/project languages (skip batch inserts)
CREATE OR REPLACE FUNCTION public.trigger_acl_refresh_languages_ins_upd()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_languages_for_asset(NEW.asset_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trigger_acl_refresh_languages_del()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_languages_for_asset(OLD.asset_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_acl_refresh_languages_ins ON public.asset_content_link;
CREATE TRIGGER trg_acl_refresh_languages_ins
AFTER INSERT ON public.asset_content_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_acl_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_acl_refresh_languages_upd ON public.asset_content_link;
CREATE TRIGGER trg_acl_refresh_languages_upd
AFTER UPDATE OF asset_id, source_language_id, active ON public.asset_content_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_acl_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_acl_refresh_languages_del ON public.asset_content_link;
CREATE TRIGGER trg_acl_refresh_languages_del
AFTER DELETE ON public.asset_content_link
FOR EACH ROW
WHEN (OLD.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_acl_refresh_languages_del();

-- Triggers for quest_asset_link: recompute for affected quest and its project (batch-safe)
CREATE OR REPLACE FUNCTION public.trigger_qal_refresh_languages_ins_upd()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE pid uuid; BEGIN
  PERFORM public.update_quest_language_arrays(NEW.quest_id);
  SELECT project_id INTO pid FROM quest WHERE id = NEW.quest_id;
  IF pid IS NOT NULL THEN PERFORM public.update_project_language_arrays(pid); END IF;
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.trigger_qal_refresh_languages_del()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE pid uuid; BEGIN
  PERFORM public.update_quest_language_arrays(OLD.quest_id);
  SELECT project_id INTO pid FROM quest WHERE id = OLD.quest_id;
  IF pid IS NOT NULL THEN PERFORM public.update_project_language_arrays(pid); END IF;
  RETURN OLD; END; $$;

DROP TRIGGER IF EXISTS trg_qal_refresh_languages_ins ON public.quest_asset_link;
CREATE TRIGGER trg_qal_refresh_languages_ins
AFTER INSERT ON public.quest_asset_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_qal_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_qal_refresh_languages_upd ON public.quest_asset_link;
CREATE TRIGGER trg_qal_refresh_languages_upd
AFTER UPDATE OF quest_id, asset_id, active, visible ON public.quest_asset_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_qal_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_qal_refresh_languages_del ON public.quest_asset_link;
CREATE TRIGGER trg_qal_refresh_languages_del
AFTER DELETE ON public.quest_asset_link
FOR EACH ROW
WHEN (OLD.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_qal_refresh_languages_del();

-- Triggers for quest: recompute its and parent project's arrays (batch-safe)
CREATE OR REPLACE FUNCTION public.trigger_quest_refresh_languages_ins_upd()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.update_quest_language_arrays(NEW.id);
  PERFORM public.update_project_language_arrays(NEW.project_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quest_refresh_languages_ins ON public.quest;
CREATE TRIGGER trg_quest_refresh_languages_ins
AFTER INSERT ON public.quest
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_quest_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_quest_refresh_languages_upd ON public.quest;
CREATE TRIGGER trg_quest_refresh_languages_upd
AFTER UPDATE OF project_id, active, visible ON public.quest
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_quest_refresh_languages_ins_upd();

-- Triggers for project_language_link: recompute project arrays (batch-safe)
CREATE OR REPLACE FUNCTION public.trigger_pll_refresh_languages()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN
  PERFORM public.update_project_language_arrays(COALESCE(NEW.project_id, OLD.project_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_pll_refresh_languages_ins ON public.project_language_link;
CREATE TRIGGER trg_pll_refresh_languages_ins
AFTER INSERT ON public.project_language_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_pll_refresh_languages();

DROP TRIGGER IF EXISTS trg_pll_refresh_languages_upd ON public.project_language_link;
CREATE TRIGGER trg_pll_refresh_languages_upd
AFTER UPDATE OF project_id, language_id, language_type, active ON public.project_language_link
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_pll_refresh_languages();

DROP TRIGGER IF EXISTS trg_pll_refresh_languages_del ON public.project_language_link;
CREATE TRIGGER trg_pll_refresh_languages_del
AFTER DELETE ON public.project_language_link
FOR EACH ROW
WHEN (OLD.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_pll_refresh_languages();

-- Triggers for asset: refresh languages for related quests/projects (batch-safe)
CREATE OR REPLACE FUNCTION public.trigger_asset_refresh_languages()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN
  PERFORM public.refresh_languages_for_asset(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_asset_refresh_languages_ins ON public.asset;
CREATE TRIGGER trg_asset_refresh_languages_ins
AFTER INSERT ON public.asset
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_asset_refresh_languages();

-- Triggers for translation: refresh languages for related quests/projects (batch-safe)
CREATE OR REPLACE FUNCTION public.trigger_translation_refresh_languages_ins_upd()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN
  PERFORM public.refresh_languages_for_asset(NEW.asset_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trigger_translation_refresh_languages_del()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN
  PERFORM public.refresh_languages_for_asset(OLD.asset_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_translation_refresh_languages_ins ON public.translation;
CREATE TRIGGER trg_translation_refresh_languages_ins
AFTER INSERT ON public.translation
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_translation_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_translation_refresh_languages_upd ON public.translation;
CREATE TRIGGER trg_translation_refresh_languages_upd
AFTER UPDATE OF asset_id, target_language_id, active ON public.translation
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_translation_refresh_languages_ins_upd();

DROP TRIGGER IF EXISTS trg_translation_refresh_languages_del ON public.translation;
CREATE TRIGGER trg_translation_refresh_languages_del
AFTER DELETE ON public.translation
FOR EACH ROW
WHEN (OLD.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_translation_refresh_languages_del();

DROP TRIGGER IF EXISTS trg_asset_refresh_languages_upd ON public.asset;
CREATE TRIGGER trg_asset_refresh_languages_upd
AFTER UPDATE OF active, visible ON public.asset
FOR EACH ROW
WHEN (NEW.ingest_batch_id IS NULL)
EXECUTE FUNCTION public.trigger_asset_refresh_languages();