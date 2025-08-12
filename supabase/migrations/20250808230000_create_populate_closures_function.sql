-- Create an on-demand function to populate closure tables after seeding
-- Safe to run multiple times; intended for local dev use

CREATE OR REPLACE FUNCTION public.populate_closures()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_quest boolean := to_regclass('public.quest') IS NOT NULL;
  has_qc boolean := to_regclass('public.quest_closure') IS NOT NULL;
  has_project boolean := to_regclass('public.project') IS NOT NULL;
  has_pc boolean := to_regclass('public.project_closure') IS NOT NULL;
  qid uuid;
  pid uuid;
BEGIN
  -- Populate project_language_link from legacy fields if migrator exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'migrate_project_languages') THEN
    PERFORM public.migrate_project_languages();
  END IF;

  -- Backfill content-level source language from asset when missing
  IF to_regclass('public.asset') IS NOT NULL AND to_regclass('public.asset_content_link') IS NOT NULL THEN
    UPDATE public.asset_content_link AS acl
    SET source_language_id = a.source_language_id
    FROM public.asset AS a
    WHERE a.id = acl.asset_id
      AND acl.source_language_id IS NULL;
  END IF;

  -- Quest closures: ensure rows, rebuild aggregates, refresh language arrays
  IF has_quest AND has_qc THEN
    INSERT INTO public.quest_closure (quest_id, project_id)
    SELECT q.id, q.project_id
    FROM public.quest q
    ON CONFLICT (quest_id) DO NOTHING;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rebuild_all_quest_closures') THEN
      PERFORM public.rebuild_all_quest_closures();
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_quest_language_arrays') THEN
      FOR qid IN (SELECT id FROM public.quest) LOOP
        PERFORM public.update_quest_language_arrays(qid);
      END LOOP;
    END IF;
  END IF;

  -- Project closures: ensure rows, rebuild aggregates, refresh language arrays
  IF has_project AND has_pc THEN
    INSERT INTO public.project_closure (project_id)
    SELECT p.id
    FROM public.project p
    ON CONFLICT (project_id) DO NOTHING;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rebuild_single_project_closure') THEN
      FOR pid IN (SELECT id FROM public.project) LOOP
        PERFORM public.rebuild_single_project_closure(pid);
      END LOOP;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_project_language_arrays') THEN
      FOR pid IN (SELECT id FROM public.project) LOOP
        PERFORM public.update_project_language_arrays(pid);
      END LOOP;
    END IF;
  END IF;
END;
$$;

-- Allow only service_role to execute via API (anon/auth can be added if desired)
GRANT EXECUTE ON FUNCTION public.populate_closures() TO service_role;



