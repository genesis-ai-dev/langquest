-- ============================================================================
-- Backfill existing projects with template links
-- ============================================================================
-- Creates backward-compatible templates for Bible and FIA projects,
-- then links existing projects to them via project_template_link.
-- Sets template_link_id on quests and assets.
-- template_node_id population is handled by external scripts that generate
-- nanoid(10) IDs and match via tree-walking + metadata (per C10).
-- ============================================================================

-- ============================================================================
-- 1. Seed frozen Protestant Bible template (minimal structure placeholder)
-- ============================================================================

INSERT INTO public.template (
  id, slug, name, icon, structure,
  auto_sync, shared, active, locked_for_backward_compat,
  download_profiles
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'protestant-bible-v2-frozen',
  'Protestant Bible (Legacy)',
  'book',
  '{"format_version":1,"root":{"id":"root","name":"Protestant Bible","node_type":"root","linkable_type":"quest","children":[]}}',
  true,
  true,
  true,
  true,
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Seed frozen FIA template
-- ============================================================================

INSERT INTO public.template (
  id, slug, name, icon, structure,
  auto_sync, shared, active, locked_for_backward_compat,
  download_profiles
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'fia-v2-frozen',
  'FIA Pericopes (Legacy)',
  'scroll-text',
  '{"format_version":1,"root":{"id":"root","name":"FIA Pericopes","node_type":"root","linkable_type":"quest","children":[]}}',
  true,
  true,
  true,
  true,
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Link existing Bible projects to the frozen template
-- ============================================================================

INSERT INTO project_template_link (project_id, template_id, role, active, download_profiles)
SELECT
  p.id,
  'a0000000-0000-0000-0000-000000000001',
  'primary',
  true,
  COALESCE(p.download_profiles, '{}')
FROM public.project p
WHERE p.template = 'bible'
  AND p.active = true
ON CONFLICT (project_id, template_id) DO NOTHING;

-- ============================================================================
-- 4. Link existing FIA projects to the frozen template
-- ============================================================================

INSERT INTO project_template_link (project_id, template_id, role, active, download_profiles)
SELECT
  p.id,
  'a0000000-0000-0000-0000-000000000002',
  'primary',
  true,
  COALESCE(p.download_profiles, '{}')
FROM public.project p
WHERE p.template = 'fia'
  AND p.active = true
ON CONFLICT (project_id, template_id) DO NOTHING;

-- ============================================================================
-- 5. Populate template_link_id on quests for Bible projects
-- ============================================================================

UPDATE public.quest q
SET template_link_id = ptl.id
FROM public.project_template_link ptl
WHERE q.project_id = ptl.project_id
  AND ptl.template_id = 'a0000000-0000-0000-0000-000000000001'
  AND q.template_link_id IS NULL;

-- ============================================================================
-- 6. Populate template_link_id on quests for FIA projects
-- ============================================================================

UPDATE public.quest q
SET template_link_id = ptl.id
FROM public.project_template_link ptl
WHERE q.project_id = ptl.project_id
  AND ptl.template_id = 'a0000000-0000-0000-0000-000000000002'
  AND q.template_link_id IS NULL;

-- ============================================================================
-- 7. Populate template_link_id on assets for Bible/FIA projects
-- ============================================================================

UPDATE public.asset a
SET template_link_id = ptl.id
FROM public.project_template_link ptl
WHERE a.project_id = ptl.project_id
  AND ptl.active = true
  AND a.template_link_id IS NULL;

-- ============================================================================
-- 8. template_node_id population
-- ============================================================================
-- Handled externally:
--   Bible: scripts/generate-bible-template.py (generates nanoid IDs, backfills quests)
--   FIA:   fia-refresh-templates edge function (generates nanoid IDs, backfills quests)
-- These scripts use tree-walking + metadata matching per constraint C10
-- (opaque nanoid(10) IDs, not path-derived).
