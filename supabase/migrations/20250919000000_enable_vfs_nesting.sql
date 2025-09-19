-- Enable virtual file system style nesting for quests and assets
-- Adds quest.parent_id and asset.project_id / asset.parent_id
-- Idempotent and safe to run multiple times

-- ==========================
-- quest.parent_id (self FK)
-- ==========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quest'
      AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.quest ADD COLUMN parent_id uuid NULL;
  END IF;
END $$;

-- ==========================
-- tag.key / tag.value (augment tag schema)
-- ==========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag'
      AND column_name = 'key'
  ) THEN
    ALTER TABLE public.tag ADD COLUMN "key" text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag'
      AND column_name = 'value'
  ) THEN
    ALTER TABLE public.tag ADD COLUMN "value" text NULL;
  END IF;
END $$;

-- Backfill key/value from existing name if present
DO $$
BEGIN
  -- Only backfill rows where key/value are NULL
  UPDATE public.tag
  SET
    "key" = COALESCE("key", split_part(name, ':', 1)),
    "value" = COALESCE(
      "value",
      COALESCE(NULLIF(split_part(name, ':', 2), ''), '')
    );
END $$;

-- Enforce NOT NULL on key/value and defaults
DO $$
BEGIN
  -- Set defaults first to satisfy future inserts
  ALTER TABLE public.tag ALTER COLUMN "key" SET DEFAULT '';
  ALTER TABLE public.tag ALTER COLUMN "value" SET DEFAULT '';

  -- Ensure no NULLs remain
  UPDATE public.tag SET "key" = '' WHERE "key" IS NULL;
  UPDATE public.tag SET "value" = '' WHERE "value" IS NULL;

  -- Apply NOT NULL constraints idempotently
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'tag_key_not_null'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.tag ALTER COLUMN "key" SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'tag_value_not_null'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.tag ALTER COLUMN "value" SET NOT NULL;
  END IF;
END $$;

-- Unique index on (key, value) and helper index on key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'tag_key_value_unique'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX tag_key_value_unique ON public.tag ("key", "value");
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'tag_key_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX tag_key_idx ON public.tag ("key");
  END IF;
END $$;

-- Index for quest.parent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'quest_parent_id_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX quest_parent_id_idx ON public.quest (parent_id);
  END IF;
END $$;

-- Foreign key: quest.parent_id -> quest.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'quest_parent_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.quest
      ADD CONSTRAINT quest_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.quest (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================
-- asset.project_id (FK project)
-- asset.parent_id (self FK)
-- ==========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset'
      AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.asset ADD COLUMN project_id uuid NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset'
      AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.asset ADD COLUMN parent_id uuid NULL;
  END IF;
END $$;

-- Indexes for asset.project_id and asset.parent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'asset_project_id_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX asset_project_id_idx ON public.asset (project_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'asset_parent_id_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX asset_parent_id_idx ON public.asset (parent_id);
  END IF;
END $$;

-- Foreign key: asset.project_id -> project.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'asset_project_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.asset
      ADD CONSTRAINT asset_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES public.project (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Foreign key: asset.parent_id -> asset.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'asset_parent_id_fkey'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.asset
      ADD CONSTRAINT asset_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.asset (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;


