-- langquest_bootstrap.sql
-- Assumes: Glottolog tables already loaded in the same database (no foreign keys to them).
-- Safety: run inside a transaction so reruns are safe-ish.

-- BEGIN;

-- 1) Extensions used
-- Supabase has pgcrypto; use gen_random_uuid() for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Enums (idempotent-ish)
-- Create enums idempotently without dynamic SQL
CREATE TYPE languoid_level AS ENUM ('family','language','dialect');
CREATE TYPE alias_type     AS ENUM ('endonym','exonym');

-- 3) Core tables (as in subschema)
--    Tweak: allow multiple alias names per (subject,label,alias_type) by including name in the UNIQUE.
CREATE TABLE IF NOT EXISTS public.languoid (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES public.languoid(id) ON DELETE SET NULL,
  name         TEXT,
  level        languoid_level NOT NULL,
  ui_ready     BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.languoid_alias (
  id                  TEXT PRIMARY KEY,
  subject_languoid_id TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE CASCADE,
  label_languoid_id   TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  alias_type          alias_type NOT NULL,
  source_names        TEXT[] NOT NULL DEFAULT '{}',
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replace the subschema's UNIQUE(subject,label,alias_type) with UNIQUE(subject,label,alias_type,name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.languoid_alias'::regclass
      AND conname = 'uq_languoid_alias'
  ) THEN
    EXECUTE 'ALTER TABLE public.languoid_alias DROP CONSTRAINT uq_languoid_alias';
  END IF;
  EXECUTE 'ALTER TABLE public.languoid_alias
           ADD CONSTRAINT uq_languoid_alias UNIQUE (subject_languoid_id, label_languoid_id, alias_type, name)';
END$$;

CREATE TABLE IF NOT EXISTS public.languoid_source (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  version           TEXT,
  languoid_id       TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE CASCADE,
  unique_identifier TEXT,
  url               TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_languoid_source UNIQUE (languoid_id, unique_identifier)
);

CREATE TABLE IF NOT EXISTS public.languoid_property (
  id           TEXT PRIMARY KEY,
  languoid_id  TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_languoid_property UNIQUE (languoid_id, key)
);

create index if not exists idx_languoid_parent        ON public.languoid(parent_id);
CREATE INDEX IF NOT EXISTS idx_languoid_alias_subject ON public.languoid_alias(subject_languoid_id);
CREATE INDEX IF NOT EXISTS idx_languoid_alias_label   ON public.languoid_alias(label_languoid_id);
CREATE INDEX IF NOT EXISTS idx_languoid_source_lid    ON public.languoid_source(languoid_id);
CREATE INDEX IF NOT EXISTS idx_languoid_prop_lid      ON public.languoid_property(languoid_id);


-- COMMIT;

---------------------------------------------------------

-- Regional tables

-- Load regions (macroareas, countries) from Glottolog and link to existing languoid records
-- Assumes Glottolog tables (public.language, public.languoid, public.valueset, public.value, public.domainelement)
-- and * tables defined in langquest_region_languoid_subschema.sql already exist.

-- BEGIN;

-- Ensure region_level enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'region_level' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE TYPE public.region_level AS ENUM (''continent'',''nation'',''subnational'')';
  END IF;
END$$;

-- Create Region tables if missing
CREATE TABLE IF NOT EXISTS public.region (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES public.region(id) ON DELETE SET NULL,
  name         TEXT,
  level        region_level NOT NULL,
  geometry     BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.region_alias (
  id                 TEXT PRIMARY KEY,
  subject_region_id  TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  label_languoid_id  TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE RESTRICT,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_region_alias UNIQUE (subject_region_id, label_languoid_id)
);

CREATE TABLE IF NOT EXISTS public.region_source (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  version           TEXT,
  region_id         TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  unique_identifier TEXT,
  url               TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_region_source UNIQUE (region_id, unique_identifier)
);

CREATE TABLE IF NOT EXISTS public.region_property (
  id           TEXT PRIMARY KEY,
  region_id    TEXT NOT NULL REFERENCES public.region(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_region_property UNIQUE (region_id, key)
);

CREATE TABLE IF NOT EXISTS public.languoid_region (
  id           TEXT PRIMARY KEY,
  languoid_id  TEXT NOT NULL REFERENCES public.languoid(id) ON DELETE CASCADE,
  region_id    TEXT NOT NULL REFERENCES public.region(id)   ON DELETE CASCADE,
  majority     BOOLEAN DEFAULT NULL,
  official     BOOLEAN DEFAULT NULL,
  native       BOOLEAN DEFAULT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_languoid_region UNIQUE (languoid_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_region_alias_subject ON public.region_alias(subject_region_id);
CREATE INDEX IF NOT EXISTS idx_region_alias_label   ON public.region_alias(label_languoid_id);
CREATE INDEX IF NOT EXISTS idx_region_source_rid    ON public.region_source(region_id);
CREATE INDEX IF NOT EXISTS idx_region_prop_rid      ON public.region_property(region_id);
CREATE INDEX IF NOT EXISTS idx_lreg_languoid        ON public.languoid_region(languoid_id);
CREATE INDEX IF NOT EXISTS idx_lreg_region          ON public.languoid_region(region_id);

-- COMMIT;

-- BEGIN;
-- RPC: search_languoids(q TEXT, max_rows INT = 100)
-- Returns minimal tree covering matches in languoid.name and languoid_alias.name,
-- including ancestors up to roots. Indicates if a row is a direct match and the alias text if matched by alias.

create or replace function public.search_languoids(q text, max_rows int default 100)
returns table (
  id text,
  parent_id text,
  name text,
  level public.languoid_level,
  is_match boolean,
  match_alias text
)
language sql
stable
as $$
with recursive term as (
  select '%' || q || '%' as pat
)
, matches as (
  -- Canonical name matches
  select l.id, l.parent_id, l.name, l.level, true as is_match, null::text as match_alias
  from public.languoid l, term
  where l.name ilike (select pat from term)

  union

  -- Alias matches, annotate matched alias text
  select la.subject_languoid_id as id, l.parent_id, l.name, l.level, true as is_match, la.name as match_alias
  from public.languoid_alias la
  join public.languoid l on l.id = la.subject_languoid_id
  join term on true
  where la.name ilike (select pat from term)
)
, limited_matches as (
  select distinct on (id) id, parent_id, name, level, is_match, match_alias
  from matches
  order by id
  limit max_rows
)
, ancestors as (
  -- Recursive union to add all ancestors of the limited matches
  select id, parent_id, name, level, is_match, match_alias from limited_matches
  union all
  select p.id, p.parent_id, p.name, p.level, false as is_match, null::text as match_alias
  from public.languoid p
  join ancestors a on a.parent_id = p.id
)
select distinct on (id) id, parent_id, name, level, is_match, match_alias
from ancestors
order by id;
$$;

grant execute on function public.search_languoids(text, int) to anon, authenticated;


-- RPC: list_nations_with_languages(names text[] default null)
-- When names is null, returns all nations with nested languages array
-- When names provided, filters to those country names (case-insensitive exact match)

create or replace function public.list_nations_with_languages(names text[] default null)
returns table (
  region_id text,
  region_name text,
  languages jsonb
)
language sql
stable
as $$
with nations as (
  select r.id, r.name
  from public.region r
  where r.level = 'nation'
    and (
      names is null
      or exists (
        select 1 from unnest(names) n
        where lower(n) = lower(r.name)
      )
    )
)
, lang_rows as (
  select lr.region_id,
         jsonb_build_object('id', lq.id, 'name', lq.name, 'level', lq.level) as lang
  from public.languoid_region lr
  join public.languoid lq on lq.id = lr.languoid_id
  where lr.region_id in (select id from nations)
)
select n.id as region_id,
       n.name as region_name,
       coalesce((select jsonb_agg(lang order by (lang->>'name')) from lang_rows where region_id = n.id), '[]'::jsonb) as languages
from nations n
order by n.name;
$$;

grant execute on function public.list_nations_with_languages(text[]) to anon, authenticated;

-- Optional: list all nation names (id + name)
create or replace function public.list_nation_names()
returns table (
  region_id text,
  region_name text
)
language sql
stable
as $$
select id, name
from public.region
where level = 'nation'
order by name;
$$;

grant execute on function public.list_nation_names() to anon, authenticated;


-- COMMIT;


-- RLS: enable and policies for language and region tables
-- Everyone can read; only authenticated can insert; no updates/deletes

ALTER TABLE public.languoid ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.languoid TO anon;
GRANT SELECT ON TABLE public.languoid TO authenticated;
GRANT INSERT ON TABLE public.languoid TO authenticated;
CREATE POLICY "languoid_select_policy"
ON public.languoid
FOR SELECT
TO public
USING (true);
CREATE POLICY "languoid_insert_policy"
ON public.languoid
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.languoid_alias ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.languoid_alias TO anon;
GRANT SELECT ON TABLE public.languoid_alias TO authenticated;
GRANT INSERT ON TABLE public.languoid_alias TO authenticated;
CREATE POLICY "languoid_alias_select_policy"
ON public.languoid_alias
FOR SELECT
TO public
USING (true);
CREATE POLICY "languoid_alias_insert_policy"
ON public.languoid_alias
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.languoid_source ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.languoid_source TO anon;
GRANT SELECT ON TABLE public.languoid_source TO authenticated;
GRANT INSERT ON TABLE public.languoid_source TO authenticated;
CREATE POLICY "languoid_source_select_policy"
ON public.languoid_source
FOR SELECT
TO public
USING (true);
CREATE POLICY "languoid_source_insert_policy"
ON public.languoid_source
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.languoid_property ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.languoid_property TO anon;
GRANT SELECT ON TABLE public.languoid_property TO authenticated;
GRANT INSERT ON TABLE public.languoid_property TO authenticated;
CREATE POLICY "languoid_property_select_policy"
ON public.languoid_property
FOR SELECT
TO public
USING (true);
CREATE POLICY "languoid_property_insert_policy"
ON public.languoid_property
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.region ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.region TO anon;
GRANT SELECT ON TABLE public.region TO authenticated;
GRANT INSERT ON TABLE public.region TO authenticated;
CREATE POLICY "region_select_policy"
ON public.region
FOR SELECT
TO public
USING (true);
CREATE POLICY "region_insert_policy"
ON public.region
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.region_alias ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.region_alias TO anon;
GRANT SELECT ON TABLE public.region_alias TO authenticated;
GRANT INSERT ON TABLE public.region_alias TO authenticated;
CREATE POLICY "region_alias_select_policy"
ON public.region_alias
FOR SELECT
TO public
USING (true);
CREATE POLICY "region_alias_insert_policy"
ON public.region_alias
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.region_source ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.region_source TO anon;
GRANT SELECT ON TABLE public.region_source TO authenticated;
GRANT INSERT ON TABLE public.region_source TO authenticated;
CREATE POLICY "region_source_select_policy"
ON public.region_source
FOR SELECT
TO public
USING (true);
CREATE POLICY "region_source_insert_policy"
ON public.region_source
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.region_property ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.region_property TO anon;
GRANT SELECT ON TABLE public.region_property TO authenticated;
GRANT INSERT ON TABLE public.region_property TO authenticated;
CREATE POLICY "region_property_select_policy"
ON public.region_property
FOR SELECT
TO public
USING (true);
CREATE POLICY "region_property_insert_policy"
ON public.region_property
FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.languoid_region ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.languoid_region TO anon;
GRANT SELECT ON TABLE public.languoid_region TO authenticated;
GRANT INSERT ON TABLE public.languoid_region TO authenticated;
CREATE POLICY "languoid_region_select_policy"
ON public.languoid_region
FOR SELECT
TO public
USING (true);
CREATE POLICY "languoid_region_insert_policy"
ON public.languoid_region
FOR INSERT
TO authenticated
WITH CHECK (true);


