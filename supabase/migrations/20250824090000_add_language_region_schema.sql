-- Language/Region foundation for external datasets (Wikidata/Glottolog/etc.)
-- All IDs are TEXT for portability; JSONB used for source payloads.

-- ---------- Core: region ----------

CREATE TABLE IF NOT EXISTS public.region (
  id               TEXT PRIMARY KEY,
  parent_id        TEXT REFERENCES public.region(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  path             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.region_property (
  id               TEXT PRIMARY KEY,
  region_id        TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  value            TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT region_property_unique_active UNIQUE (region_id, key)
);

CREATE TABLE IF NOT EXISTS public.region_alias (
  id               TEXT PRIMARY KEY,
  region_id        TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  alias_name       TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT region_alias_unique_active UNIQUE (region_id, alias_name)
);

CREATE TABLE IF NOT EXISTS public.region_source (
  id               TEXT PRIMARY KEY,
  region_id        TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  source           TEXT NOT NULL,
  version          TEXT,
  external_id      TEXT,
  url              TEXT,
  data             JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

-- ---------- Core: language entities (family/language/dialect) ----------

DO $$ BEGIN
  CREATE TYPE public.language_level AS ENUM ('family','language','dialect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.language_entity (
  id               TEXT PRIMARY KEY,
  parent_id        TEXT REFERENCES public.language_entity(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  level            public.language_level NOT NULL,
  path             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT language_entity_name_parent UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS public.language_alias (
  id               TEXT PRIMARY KEY,
  language_entity_id TEXT NOT NULL REFERENCES public.language_entity(id) ON DELETE CASCADE,
  alias_name       TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT language_alias_unique_active UNIQUE (language_entity_id, alias_name)
);

CREATE TABLE IF NOT EXISTS public.language_entity_source (
  id               TEXT PRIMARY KEY,
  language_entity_id TEXT NOT NULL REFERENCES public.language_entity(id) ON DELETE CASCADE,
  source           TEXT NOT NULL,
  external_id      TEXT NOT NULL,
  version          TEXT,
  url              TEXT,
  data             JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT language_entity_source_unique UNIQUE (language_entity_id, source, external_id)
);

CREATE TABLE IF NOT EXISTS public.language_property (
  id               TEXT PRIMARY KEY,
  language_entity_id TEXT NOT NULL REFERENCES public.language_entity(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  value            TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT language_property_unique_active UNIQUE (language_entity_id, key)
);

-- ---------- Linking: languages present in regions ----------

CREATE TABLE IF NOT EXISTS public.language_entity_region (
  id               TEXT PRIMARY KEY,
  language_entity_id TEXT NOT NULL REFERENCES public.language_entity(id) ON DELETE CASCADE,
  region_id        TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  relation         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT language_entity_region_unique_active UNIQUE (language_entity_id, region_id)
);

-- ---------- Helpful indexes ----------

CREATE INDEX IF NOT EXISTS region_active_idx ON public.region(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS language_entity_active_idx ON public.language_entity(id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS region_path_idx ON public.region (path);
CREATE INDEX IF NOT EXISTS language_entity_path_idx ON public.language_entity (path);

CREATE INDEX IF NOT EXISTS les_source_idx ON public.language_entity_source (source, external_id);
CREATE INDEX IF NOT EXISTS rs_source_idx  ON public.region_source (source, external_id);


