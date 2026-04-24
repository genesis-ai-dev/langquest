-- ============================================================================
-- Template System
-- ============================================================================
-- Templates are stored as JSONB structure trees. Editing is online-only via
-- the website with fork-always publishing. The mobile app reads structure
-- JSONB only.
-- ============================================================================

-- ============================================================================
-- 1. template
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        TEXT,
  name                        TEXT NOT NULL,
  icon                        TEXT,
  structure                   JSONB NOT NULL,
  source_language_id          UUID REFERENCES public.language(id),
  copied_from_template_id     UUID REFERENCES public.template(id),
  auto_sync                   BOOLEAN NOT NULL DEFAULT FALSE,
  shared                      BOOLEAN NOT NULL DEFAULT FALSE,
  active                      BOOLEAN NOT NULL DEFAULT TRUE,
  locked_for_backward_compat  BOOLEAN NOT NULL DEFAULT FALSE,
  creator_id                  UUID REFERENCES public.profile(id),
  download_profiles           UUID[] NOT NULL DEFAULT '{}',
  project_count               INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS template_slug_idx
  ON public.template(slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS template_active_shared_idx
  ON public.template(source_language_id, auto_sync, project_count DESC)
  WHERE active = true AND shared = true;

CREATE INDEX IF NOT EXISTS template_auto_sync_idx
  ON public.template(auto_sync) WHERE active = true;

-- ============================================================================
-- 2. project_template_link
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_template_link (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  template_id   UUID NOT NULL REFERENCES public.template(id),
  role          TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  download_profiles UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, template_id)
);

CREATE INDEX IF NOT EXISTS project_template_link_project_idx
  ON public.project_template_link(project_id);

CREATE INDEX IF NOT EXISTS project_template_link_template_idx
  ON public.project_template_link(template_id);

-- ============================================================================
-- 3. template_revision (server-only audit table, NOT synced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_revision (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES public.template(id) ON DELETE CASCADE,
  structure     JSONB NOT NULL,
  actions       JSONB,
  saved_by      UUID REFERENCES public.profile(id),
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS template_revision_template_id_idx
  ON public.template_revision(template_id, saved_at DESC);

-- ============================================================================
-- 4. Add template columns to quest and asset
-- ============================================================================

ALTER TABLE public.quest
  ADD COLUMN IF NOT EXISTS template_link_id UUID REFERENCES public.project_template_link(id),
  ADD COLUMN IF NOT EXISTS template_node_id TEXT;

ALTER TABLE public.asset
  ADD COLUMN IF NOT EXISTS template_link_id UUID REFERENCES public.project_template_link(id),
  ADD COLUMN IF NOT EXISTS template_node_id TEXT,
  ADD COLUMN IF NOT EXISTS span_end_template_node_id TEXT;

CREATE INDEX IF NOT EXISTS quest_template_link_idx
  ON public.quest(template_link_id, template_node_id);

CREATE INDEX IF NOT EXISTS asset_template_link_idx
  ON public.asset(template_link_id, template_node_id);

-- ============================================================================
-- 5. project_count trigger on project_template_link
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_template_project_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.template
    SET project_count = (
      SELECT COUNT(DISTINCT project_id)
      FROM public.project_template_link
      WHERE template_id = NEW.template_id AND active = true
    )
    WHERE id = NEW.template_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.template
    SET project_count = (
      SELECT COUNT(DISTINCT project_id)
      FROM public.project_template_link
      WHERE template_id = OLD.template_id AND active = true
    )
    WHERE id = OLD.template_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_template_project_count ON public.project_template_link;
CREATE TRIGGER trg_update_template_project_count
  AFTER INSERT OR UPDATE OR DELETE ON public.project_template_link
  FOR EACH ROW
  EXECUTE FUNCTION public.update_template_project_count();

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

ALTER TABLE public.template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_template_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_revision ENABLE ROW LEVEL SECURITY;

-- template: anyone can read active templates
CREATE POLICY "Anyone can read active templates"
  ON public.template FOR SELECT
  TO authenticated
  USING (active = true);

-- template: authenticated users can insert (for fork/create)
CREATE POLICY "Authenticated users can create templates"
  ON public.template FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- template: creators and project owners can update
CREATE POLICY "Template editors can update"
  ON public.template FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_template_link ptl
      JOIN public.profile_project_link ppl ON ppl.project_id = ptl.project_id
      WHERE ptl.template_id = template.id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- project_template_link: project members can read
CREATE POLICY "Project members can read template links"
  ON public.project_template_link FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_template_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.template t
      WHERE t.id = project_template_link.template_id
        AND t.auto_sync = true
        AND t.active = true
    )
  );

-- project_template_link: project owners can insert
CREATE POLICY "Project owners can create template links"
  ON public.project_template_link FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_template_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- project_template_link: project owners can update (for fork re-pointing)
CREATE POLICY "Project owners can update template links"
  ON public.project_template_link FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_template_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- template_revision: only readable by template creators/editors
CREATE POLICY "Template editors can read revisions"
  ON public.template_revision FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.template t
      WHERE t.id = template_revision.template_id
        AND (
          t.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_template_link ptl
            JOIN public.profile_project_link ppl ON ppl.project_id = ptl.project_id
            WHERE ptl.template_id = t.id
              AND ppl.profile_id = auth.uid()
              AND ppl.membership = 'owner'
              AND ppl.active = true
          )
        )
    )
  );

-- template_revision: insert via RPCs only (service role), but allow for completeness
CREATE POLICY "System can insert revisions"
  ON public.template_revision FOR INSERT
  TO authenticated
  WITH CHECK (saved_by = auth.uid());

-- ============================================================================
-- 7. PowerSync publication
-- ============================================================================

ALTER PUBLICATION powersync ADD TABLE public.template;
ALTER PUBLICATION powersync ADD TABLE public.project_template_link;
-- template_revision is NOT added to powersync (server-only)

-- ============================================================================
-- 8. Bump schema info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schema_version', '3.0',
    'min_required_schema_version', '2.3',
    'notes', 'Added template system. Clients at 2.3+ can sync; template features require 3.0.'
  );
$$;
