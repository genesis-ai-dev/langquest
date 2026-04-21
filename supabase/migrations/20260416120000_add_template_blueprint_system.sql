-- ============================================================================
-- Blueprint-Only Template System
-- ============================================================================
-- Replaces the template_node approach entirely. Templates are stored as JSONB
-- structure trees. Editing is online-only via the website with pessimistic
-- per-blueprint locks. The mobile app reads structure JSONB only.
-- ============================================================================

-- ============================================================================
-- 1. template_blueprint
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_blueprint (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        TEXT,
  name                        TEXT NOT NULL,
  icon                        TEXT,
  structure                   JSONB NOT NULL,
  structure_version           INTEGER NOT NULL DEFAULT 1,
  source_language_id          UUID REFERENCES public.language(id),
  copied_from_blueprint_id    UUID REFERENCES public.template_blueprint(id),
  auto_sync                   BOOLEAN NOT NULL DEFAULT FALSE,
  shared                      BOOLEAN NOT NULL DEFAULT FALSE,
  active                      BOOLEAN NOT NULL DEFAULT TRUE,
  locked_for_backward_compat  BOOLEAN NOT NULL DEFAULT FALSE,
  creator_id                  UUID REFERENCES public.profile(id),
  download_profiles           UUID[] NOT NULL DEFAULT '{}',
  project_count               INTEGER NOT NULL DEFAULT 0,
  locked_by                   UUID REFERENCES public.profile(id),
  locked_at                   TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS template_blueprint_slug_idx
  ON public.template_blueprint(slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS template_blueprint_active_shared_idx
  ON public.template_blueprint(source_language_id, auto_sync, project_count DESC)
  WHERE active = true AND shared = true;

CREATE INDEX IF NOT EXISTS template_blueprint_auto_sync_idx
  ON public.template_blueprint(auto_sync) WHERE active = true;

-- ============================================================================
-- 2. project_blueprint_link
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_blueprint_link (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  blueprint_id  UUID NOT NULL REFERENCES public.template_blueprint(id),
  role          TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  download_profiles UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, blueprint_id)
);

CREATE INDEX IF NOT EXISTS project_blueprint_link_project_idx
  ON public.project_blueprint_link(project_id);

CREATE INDEX IF NOT EXISTS project_blueprint_link_blueprint_idx
  ON public.project_blueprint_link(blueprint_id);

-- ============================================================================
-- 3. blueprint_revision (server-only audit table, NOT synced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blueprint_revision (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id       UUID NOT NULL REFERENCES public.template_blueprint(id) ON DELETE CASCADE,
  structure_version  INTEGER NOT NULL,
  structure          JSONB NOT NULL,
  actions            JSONB,
  saved_by           UUID REFERENCES public.profile(id),
  saved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blueprint_revision_blueprint_id_idx
  ON public.blueprint_revision(blueprint_id, structure_version DESC);

-- ============================================================================
-- 4. Add blueprint columns to quest and asset
-- ============================================================================

ALTER TABLE public.quest
  ADD COLUMN IF NOT EXISTS blueprint_link_id UUID REFERENCES public.project_blueprint_link(id),
  ADD COLUMN IF NOT EXISTS blueprint_node_id TEXT;

ALTER TABLE public.asset
  ADD COLUMN IF NOT EXISTS blueprint_link_id UUID REFERENCES public.project_blueprint_link(id),
  ADD COLUMN IF NOT EXISTS blueprint_node_id TEXT,
  ADD COLUMN IF NOT EXISTS span_end_blueprint_node_id TEXT;

CREATE INDEX IF NOT EXISTS quest_blueprint_link_idx
  ON public.quest(blueprint_link_id, blueprint_node_id);

CREATE INDEX IF NOT EXISTS asset_blueprint_link_idx
  ON public.asset(blueprint_link_id, blueprint_node_id);

-- ============================================================================
-- 5. project_count trigger on project_blueprint_link
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_blueprint_project_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.template_blueprint
    SET project_count = (
      SELECT COUNT(DISTINCT project_id)
      FROM public.project_blueprint_link
      WHERE blueprint_id = NEW.blueprint_id AND active = true
    )
    WHERE id = NEW.blueprint_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.template_blueprint
    SET project_count = (
      SELECT COUNT(DISTINCT project_id)
      FROM public.project_blueprint_link
      WHERE blueprint_id = OLD.blueprint_id AND active = true
    )
    WHERE id = OLD.blueprint_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_blueprint_project_count ON public.project_blueprint_link;
CREATE TRIGGER trg_update_blueprint_project_count
  AFTER INSERT OR UPDATE OR DELETE ON public.project_blueprint_link
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blueprint_project_count();

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

ALTER TABLE public.template_blueprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_blueprint_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_revision ENABLE ROW LEVEL SECURITY;

-- template_blueprint: anyone can read active blueprints
CREATE POLICY "Anyone can read active blueprints"
  ON public.template_blueprint FOR SELECT
  TO authenticated
  USING (active = true);

-- template_blueprint: authenticated users can insert (for fork/create)
CREATE POLICY "Authenticated users can create blueprints"
  ON public.template_blueprint FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- template_blueprint: creators and project owners can update
CREATE POLICY "Blueprint editors can update"
  ON public.template_blueprint FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_blueprint_link pbl
      JOIN public.profile_project_link ppl ON ppl.project_id = pbl.project_id
      WHERE pbl.blueprint_id = template_blueprint.id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- project_blueprint_link: project members can read
CREATE POLICY "Project members can read blueprint links"
  ON public.project_blueprint_link FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_blueprint_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.template_blueprint bp
      WHERE bp.id = project_blueprint_link.blueprint_id
        AND bp.auto_sync = true
        AND bp.active = true
    )
  );

-- project_blueprint_link: project owners can insert
CREATE POLICY "Project owners can create blueprint links"
  ON public.project_blueprint_link FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_blueprint_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- project_blueprint_link: project owners can update (for fork re-pointing)
CREATE POLICY "Project owners can update blueprint links"
  ON public.project_blueprint_link FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = project_blueprint_link.project_id
        AND ppl.profile_id = auth.uid()
        AND ppl.membership = 'owner'
        AND ppl.active = true
    )
  );

-- blueprint_revision: only readable by blueprint creators/editors
CREATE POLICY "Blueprint editors can read revisions"
  ON public.blueprint_revision FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.template_blueprint bp
      WHERE bp.id = blueprint_revision.blueprint_id
        AND (
          bp.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_blueprint_link pbl
            JOIN public.profile_project_link ppl ON ppl.project_id = pbl.project_id
            WHERE pbl.blueprint_id = bp.id
              AND ppl.profile_id = auth.uid()
              AND ppl.membership = 'owner'
              AND ppl.active = true
          )
        )
    )
  );

-- blueprint_revision: insert via RPCs only (service role), but allow for completeness
CREATE POLICY "System can insert revisions"
  ON public.blueprint_revision FOR INSERT
  TO authenticated
  WITH CHECK (saved_by = auth.uid());

-- ============================================================================
-- 7. PowerSync publication
-- ============================================================================

ALTER PUBLICATION powersync ADD TABLE public.template_blueprint;
ALTER PUBLICATION powersync ADD TABLE public.project_blueprint_link;
-- blueprint_revision is NOT added to powersync (server-only)

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
    'notes', 'Added template_blueprint system. Clients at 2.3+ can sync; blueprint features require 3.0.'
  );
$$;
