-- Ensure creator_id foreign keys reference public.profile(id)
-- with ON UPDATE CASCADE and ON DELETE SET NULL.
-- Idempotent: safe to run multiple times.

-- Asset.creator_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'asset_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.asset DROP CONSTRAINT asset_creator_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'asset_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.asset
      ADD CONSTRAINT asset_creator_id_fkey
      FOREIGN KEY (creator_id)
      REFERENCES public.profile (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Quest.creator_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'quest_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.quest DROP CONSTRAINT quest_creator_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'quest_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.quest
      ADD CONSTRAINT quest_creator_id_fkey
      FOREIGN KEY (creator_id)
      REFERENCES public.profile (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Project.creator_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'project_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.project DROP CONSTRAINT project_creator_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'project_creator_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.project
      ADD CONSTRAINT project_creator_id_fkey
      FOREIGN KEY (creator_id)
      REFERENCES public.profile (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;


