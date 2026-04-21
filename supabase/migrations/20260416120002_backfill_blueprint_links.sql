-- ============================================================================
-- Backfill existing projects with blueprint links
-- ============================================================================
-- Creates backward-compatible blueprints for Bible and FIA projects,
-- then links existing projects to them via project_blueprint_link.
-- Sets blueprint_link_id on quests and assets.
-- blueprint_node_id population is handled by external scripts that generate
-- nanoid(10) IDs and match via tree-walking + metadata (per C10).
-- ============================================================================

-- ============================================================================
-- 1. Seed frozen Protestant Bible blueprint (minimal structure placeholder)
-- ============================================================================
-- The full tree structure will be populated by the app's backfill logic or a
-- separate data script. For the migration, we store a minimal root-only
-- structure that satisfies the NOT NULL constraint.

INSERT INTO public.template_blueprint (
  id, slug, name, icon, structure, structure_version,
  auto_sync, shared, active, locked_for_backward_compat,
  download_profiles
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'protestant-bible-v2-frozen',
  'Protestant Bible (Legacy)',
  'book',
  '{"format_version":1,"root":{"id":"root","name":"Protestant Bible","node_type":"root","linkable_type":"quest","children":[]}}',
  1,
  true,
  true,
  true,
  true,
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Seed frozen FIA blueprint
-- ============================================================================

INSERT INTO public.template_blueprint (
  id, slug, name, icon, structure, structure_version,
  auto_sync, shared, active, locked_for_backward_compat,
  download_profiles
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'fia-v2-frozen',
  'FIA Pericopes (Legacy)',
  'scroll-text',
  '{"format_version":1,"root":{"id":"root","name":"FIA Pericopes","node_type":"root","linkable_type":"quest","children":[]}}',
  1,
  true,
  true,
  true,
  true,
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Link existing Bible projects to the frozen blueprint
-- ============================================================================

INSERT INTO project_blueprint_link (project_id, blueprint_id, role, active, download_profiles)
SELECT
  p.id,
  'a0000000-0000-0000-0000-000000000001',
  'primary',
  true,
  COALESCE(p.download_profiles, '{}')
FROM public.project p
WHERE p.template = 'bible'
  AND p.active = true
ON CONFLICT (project_id, blueprint_id) DO NOTHING;

-- ============================================================================
-- 4. Link existing FIA projects to the frozen blueprint
-- ============================================================================

INSERT INTO project_blueprint_link (project_id, blueprint_id, role, active, download_profiles)
SELECT
  p.id,
  'a0000000-0000-0000-0000-000000000002',
  'primary',
  true,
  COALESCE(p.download_profiles, '{}')
FROM public.project p
WHERE p.template = 'fia'
  AND p.active = true
ON CONFLICT (project_id, blueprint_id) DO NOTHING;

-- ============================================================================
-- 5. Populate blueprint_link_id on quests for Bible projects
-- ============================================================================

UPDATE public.quest q
SET blueprint_link_id = pbl.id
FROM public.project_blueprint_link pbl
WHERE q.project_id = pbl.project_id
  AND pbl.blueprint_id = 'a0000000-0000-0000-0000-000000000001'
  AND q.blueprint_link_id IS NULL;

-- ============================================================================
-- 6. Populate blueprint_link_id on quests for FIA projects
-- ============================================================================

UPDATE public.quest q
SET blueprint_link_id = pbl.id
FROM public.project_blueprint_link pbl
WHERE q.project_id = pbl.project_id
  AND pbl.blueprint_id = 'a0000000-0000-0000-0000-000000000002'
  AND q.blueprint_link_id IS NULL;

-- ============================================================================
-- 7. Populate blueprint_link_id on assets for Bible/FIA projects
-- ============================================================================

UPDATE public.asset a
SET blueprint_link_id = pbl.id
FROM public.project_blueprint_link pbl
WHERE a.project_id = pbl.project_id
  AND pbl.active = true
  AND a.blueprint_link_id IS NULL;

-- ============================================================================
-- 8. blueprint_node_id population
-- ============================================================================
-- Handled externally:
--   Bible: scripts/generate-bible-blueprint.py (generates nanoid IDs, backfills quests)
--   FIA:   fia-refresh-blueprints edge function (generates nanoid IDs, backfills quests)
-- These scripts use tree-walking + metadata matching per constraint C10
-- (opaque nanoid(10) IDs, not path-derived).
