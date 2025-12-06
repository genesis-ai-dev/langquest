-- Migration: Add v1_to_v2 transform for languoid migration
-- Purpose: Handle uploads from v1.x clients that don't include languoid_id by:
--   1. Creating a persistent language_languoid_map table for fast lookups
--   2. Creating v1_to_v2 transform function to add languoid_id to records
--   3. Updating mutation handlers to chain v1_to_v2 transform
--   4. Updating v0_to_v1 to also include languoid_id in asset_content_link
--
-- Transform chain:
--   v0.x data → v0_to_v1 → v1.x data → v1_to_v2 → v2.0 data
--   v1.x data → v1_to_v2 → v2.0 data
--   v2.0 data → passthrough

-- ============================================================================
-- STEP 1: Create persistent language_languoid_map table
-- ============================================================================
-- This table caches the language→languoid mappings for fast lookups during
-- mutation transforms. It's populated from the same logic used in the
-- 20251125120000_add_languoid_references.sql migration.

CREATE TABLE IF NOT EXISTS public.language_languoid_map (
  language_id uuid PRIMARY KEY,
  languoid_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for reverse lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_language_languoid_map_languoid 
  ON public.language_languoid_map(languoid_id);

-- RLS: Allow authenticated users to read
ALTER TABLE public.language_languoid_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'language_languoid_map' 
      AND policyname = 'Allow authenticated read'
  ) THEN
    CREATE POLICY "Allow authenticated read"
    ON public.language_languoid_map
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Populate language_languoid_map from existing data
-- ============================================================================
-- Use the same mapping logic from STEP 4-5 of the languoid migration

-- First, insert all active languages with NULL languoid_id
INSERT INTO public.language_languoid_map (language_id, languoid_id)
SELECT l.id, l.id  -- Default to language_id as languoid_id (will be overwritten if match found)
FROM public.language l
WHERE l.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.language_languoid_map m WHERE m.language_id = l.id
  );

-- Priority 1: Match by ISO 639-3 code
UPDATE public.language_languoid_map m
SET languoid_id = (
  SELECT ls.languoid_id 
  FROM public.languoid_source ls 
  WHERE lower(trim(ls.unique_identifier)) = lower(trim(l.iso639_3))
    AND lower(ls.name) = 'iso639-3'
    AND ls.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND l.iso639_3 IS NOT NULL 
  AND trim(l.iso639_3) != ''
  AND EXISTS (
    SELECT 1 FROM public.languoid_source ls 
    WHERE lower(trim(ls.unique_identifier)) = lower(trim(l.iso639_3))
      AND lower(ls.name) = 'iso639-3'
      AND ls.active = true
  );

-- Priority 2: Match english_name in languoid.name (only if not already matched)
UPDATE public.language_languoid_map m
SET languoid_id = (
  SELECT lo.id 
  FROM public.languoid lo 
  WHERE lower(trim(lo.name)) = lower(trim(l.english_name))
    AND lo.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id = l.id  -- Still default (unmatched)
  AND l.english_name IS NOT NULL 
  AND trim(l.english_name) != ''
  AND EXISTS (
    SELECT 1 FROM public.languoid lo 
    WHERE lower(trim(lo.name)) = lower(trim(l.english_name))
      AND lo.active = true
  );

-- Priority 3: Match english_name in languoid_alias.name
UPDATE public.language_languoid_map m
SET languoid_id = (
  SELECT la.subject_languoid_id 
  FROM public.languoid_alias la 
  WHERE lower(trim(la.name)) = lower(trim(l.english_name))
    AND la.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id = l.id  -- Still default (unmatched)
  AND l.english_name IS NOT NULL 
  AND trim(l.english_name) != ''
  AND EXISTS (
    SELECT 1 FROM public.languoid_alias la 
    WHERE lower(trim(la.name)) = lower(trim(l.english_name))
      AND la.active = true
  );

-- Priority 4: Match native_name in languoid.name
UPDATE public.language_languoid_map m
SET languoid_id = (
  SELECT lo.id 
  FROM public.languoid lo 
  WHERE lower(trim(lo.name)) = lower(trim(l.native_name))
    AND lo.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id = l.id  -- Still default (unmatched)
  AND l.native_name IS NOT NULL 
  AND trim(l.native_name) != ''
  AND EXISTS (
    SELECT 1 FROM public.languoid lo 
    WHERE lower(trim(lo.name)) = lower(trim(l.native_name))
      AND lo.active = true
  );

-- Priority 5: Match native_name in languoid_alias.name
UPDATE public.language_languoid_map m
SET languoid_id = (
  SELECT la.subject_languoid_id 
  FROM public.languoid_alias la 
  WHERE lower(trim(la.name)) = lower(trim(l.native_name))
    AND la.active = true
  LIMIT 1
)
FROM public.language l
WHERE m.language_id = l.id
  AND m.languoid_id = l.id  -- Still default (unmatched)
  AND l.native_name IS NOT NULL 
  AND trim(l.native_name) != ''
  AND EXISTS (
    SELECT 1 FROM public.languoid_alias la 
    WHERE lower(trim(la.name)) = lower(trim(l.native_name))
      AND la.active = true
  );

-- For any still-unmatched languages (where languoid_id = language_id),
-- ensure a languoid record exists (created in STEP 5 of prior migration)
-- The languoid_id remains as language_id which should already exist as a languoid

-- ============================================================================
-- STEP 3: Create helper function to get or create languoid from language
-- ============================================================================
-- This function is used by the transform functions to ensure a languoid exists
-- for any language being referenced, creating one if necessary.

CREATE OR REPLACE FUNCTION public.get_or_create_languoid_for_language(p_language_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_languoid_id uuid;
  v_lang_record RECORD;
BEGIN
  -- First check the mapping table
  SELECT languoid_id INTO v_languoid_id
  FROM public.language_languoid_map
  WHERE language_id = p_language_id;
  
  IF v_languoid_id IS NOT NULL THEN
    RETURN v_languoid_id;
  END IF;
  
  -- Not in mapping table - get language details
  SELECT * INTO v_lang_record
  FROM public.language
  WHERE id = p_language_id;
  
  IF v_lang_record IS NULL THEN
    -- Language doesn't exist, return NULL
    RETURN NULL;
  END IF;
  
  -- Try to find a matching languoid using the priority order
  -- Priority 1: ISO 639-3 code
  IF v_lang_record.iso639_3 IS NOT NULL AND trim(v_lang_record.iso639_3) != '' THEN
    SELECT ls.languoid_id INTO v_languoid_id
    FROM public.languoid_source ls
    WHERE lower(trim(ls.unique_identifier)) = lower(trim(v_lang_record.iso639_3))
      AND lower(ls.name) = 'iso639-3'
      AND ls.active = true
    LIMIT 1;
    
    IF v_languoid_id IS NOT NULL THEN
      INSERT INTO public.language_languoid_map (language_id, languoid_id)
      VALUES (p_language_id, v_languoid_id)
      ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
      RETURN v_languoid_id;
    END IF;
  END IF;
  
  -- Priority 2: english_name in languoid.name
  IF v_lang_record.english_name IS NOT NULL AND trim(v_lang_record.english_name) != '' THEN
    SELECT lo.id INTO v_languoid_id
    FROM public.languoid lo
    WHERE lower(trim(lo.name)) = lower(trim(v_lang_record.english_name))
      AND lo.active = true
    LIMIT 1;
    
    IF v_languoid_id IS NOT NULL THEN
      INSERT INTO public.language_languoid_map (language_id, languoid_id)
      VALUES (p_language_id, v_languoid_id)
      ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
      RETURN v_languoid_id;
    END IF;
  END IF;
  
  -- Priority 3: english_name in languoid_alias.name
  IF v_lang_record.english_name IS NOT NULL AND trim(v_lang_record.english_name) != '' THEN
    SELECT la.subject_languoid_id INTO v_languoid_id
    FROM public.languoid_alias la
    WHERE lower(trim(la.name)) = lower(trim(v_lang_record.english_name))
      AND la.active = true
    LIMIT 1;
    
    IF v_languoid_id IS NOT NULL THEN
      INSERT INTO public.language_languoid_map (language_id, languoid_id)
      VALUES (p_language_id, v_languoid_id)
      ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
      RETURN v_languoid_id;
    END IF;
  END IF;
  
  -- Priority 4: native_name in languoid.name
  IF v_lang_record.native_name IS NOT NULL AND trim(v_lang_record.native_name) != '' THEN
    SELECT lo.id INTO v_languoid_id
    FROM public.languoid lo
    WHERE lower(trim(lo.name)) = lower(trim(v_lang_record.native_name))
      AND lo.active = true
    LIMIT 1;
    
    IF v_languoid_id IS NOT NULL THEN
      INSERT INTO public.language_languoid_map (language_id, languoid_id)
      VALUES (p_language_id, v_languoid_id)
      ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
      RETURN v_languoid_id;
    END IF;
  END IF;
  
  -- Priority 5: native_name in languoid_alias.name
  IF v_lang_record.native_name IS NOT NULL AND trim(v_lang_record.native_name) != '' THEN
    SELECT la.subject_languoid_id INTO v_languoid_id
    FROM public.languoid_alias la
    WHERE lower(trim(la.name)) = lower(trim(v_lang_record.native_name))
      AND la.active = true
    LIMIT 1;
    
    IF v_languoid_id IS NOT NULL THEN
      INSERT INTO public.language_languoid_map (language_id, languoid_id)
      VALUES (p_language_id, v_languoid_id)
      ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
      RETURN v_languoid_id;
    END IF;
  END IF;
  
  -- No match found - create a new languoid from the language
  v_languoid_id := p_language_id;  -- Use same UUID for consistency
  
  INSERT INTO public.languoid (
    id,
    name,
    level,
    ui_ready,
    active,
    creator_id,
    created_at,
    last_updated
  ) VALUES (
    v_languoid_id,
    COALESCE(
      NULLIF(trim(v_lang_record.english_name), ''),
      NULLIF(trim(v_lang_record.native_name), ''),
      'Unknown'
    ),
    'language',
    COALESCE(v_lang_record.ui_ready, false),
    true,
    v_lang_record.creator_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create languoid_source if iso639-3 code exists
  IF v_lang_record.iso639_3 IS NOT NULL AND trim(v_lang_record.iso639_3) != '' THEN
    INSERT INTO public.languoid_source (
      id,
      name,
      languoid_id,
      unique_identifier,
      active,
      creator_id,
      created_at,
      last_updated
    ) VALUES (
      gen_random_uuid(),
      'iso639-3',
      v_languoid_id,
      trim(v_lang_record.iso639_3),
      true,
      v_lang_record.creator_id,
      NOW(),
      NOW()
    )
    ON CONFLICT (languoid_id, unique_identifier) DO NOTHING;
  END IF;
  
  -- Cache in mapping table
  INSERT INTO public.language_languoid_map (language_id, languoid_id)
  VALUES (p_language_id, v_languoid_id)
  ON CONFLICT (language_id) DO UPDATE SET languoid_id = EXCLUDED.languoid_id;
  
  RETURN v_languoid_id;
END;
$$;

-- ============================================================================
-- STEP 4: Create v1_to_v2 transform function
-- ============================================================================
-- This function adds languoid_id to records that have language_id references
-- but no languoid_id (i.e., records from v1.x clients).

CREATE OR REPLACE FUNCTION public.v1_to_v2(
  p_ops public.mutation_op[],
  p_meta jsonb
)
RETURNS public.mutation_op[]
LANGUAGE plpgsql
AS $$
DECLARE
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  v_meta text := coalesce(p_meta->>'schema_version', '');
  v_language_id uuid;
  v_languoid_id uuid;
  v_record jsonb;
BEGIN
  raise log '[v1_to_v2] start meta=% ops_count=%',
    v_meta,
    coalesce(array_length(p_ops,1),0);

  FOREACH op IN ARRAY p_ops LOOP
    raise log '[v1_to_v2] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    -- Handle asset_content_link: add languoid_id from source_language_id
    IF lower(op.table_name) = 'asset_content_link' THEN
      v_record := op.record;
      
      -- Only add languoid_id if not already present and source_language_id exists
      IF (v_record->>'languoid_id') IS NULL AND (v_record->>'source_language_id') IS NOT NULL THEN
        BEGIN
          v_language_id := (v_record->>'source_language_id')::uuid;
          v_languoid_id := public.get_or_create_languoid_for_language(v_language_id);
          
          IF v_languoid_id IS NOT NULL THEN
            v_record := v_record || jsonb_build_object('languoid_id', v_languoid_id::text);
            raise log '[v1_to_v2] asset_content_link: added languoid_id=% from source_language_id=%',
              v_languoid_id, v_language_id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          raise log '[v1_to_v2] asset_content_link: failed to get languoid for language_id=%',
            v_record->>'source_language_id';
        END;
      END IF;
      
      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
      
    -- Handle project_language_link: add languoid_id from language_id
    ELSIF lower(op.table_name) = 'project_language_link' THEN
      v_record := op.record;
      
      -- Only add languoid_id if not already present and language_id exists
      IF (v_record->>'languoid_id') IS NULL AND (v_record->>'language_id') IS NOT NULL THEN
        BEGIN
          v_language_id := (v_record->>'language_id')::uuid;
          v_languoid_id := public.get_or_create_languoid_for_language(v_language_id);
          
          IF v_languoid_id IS NOT NULL THEN
            v_record := v_record || jsonb_build_object('languoid_id', v_languoid_id::text);
            raise log '[v1_to_v2] project_language_link: added languoid_id=% from language_id=%',
              v_languoid_id, v_language_id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          raise log '[v1_to_v2] project_language_link: failed to get languoid for language_id=%',
            v_record->>'language_id';
        END;
      END IF;
      
      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
      
    -- Handle profile: add ui_languoid_id from ui_language_id
    ELSIF lower(op.table_name) = 'profile' THEN
      v_record := op.record;
      
      -- Only add ui_languoid_id if not already present and ui_language_id exists
      IF (v_record->>'ui_languoid_id') IS NULL AND (v_record->>'ui_language_id') IS NOT NULL THEN
        BEGIN
          v_language_id := (v_record->>'ui_language_id')::uuid;
          v_languoid_id := public.get_or_create_languoid_for_language(v_language_id);
          
          IF v_languoid_id IS NOT NULL THEN
            v_record := v_record || jsonb_build_object('ui_languoid_id', v_languoid_id::text);
            raise log '[v1_to_v2] profile: added ui_languoid_id=% from ui_language_id=%',
              v_languoid_id, v_language_id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          raise log '[v1_to_v2] profile: failed to get languoid for ui_language_id=%',
            v_record->>'ui_language_id';
        END;
      END IF;
      
      out_ops := out_ops || (row(op.table_name, op.op, v_record))::public.mutation_op;
      
    ELSE
      -- Passthrough for all other tables
      out_ops := out_ops || op;
    END IF;
  END LOOP;

  raise log '[v1_to_v2] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  RETURN out_ops;
END;
$$;

-- ============================================================================
-- STEP 5: Recreate v0_to_v1 (unchanged from prior migration)
-- ============================================================================
-- v0_to_v1 produces pure v1 data (without languoid_id).
-- The v1_to_v2 transform will add languoid_id in the next step of the chain.

CREATE OR REPLACE FUNCTION public.v0_to_v1(
  p_ops public.mutation_op[],
  p_meta jsonb
)
RETURNS public.mutation_op[]
LANGUAGE plpgsql
AS $$
DECLARE
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  new_ops public.mutation_op[] := '{}';
  v_meta text := coalesce(p_meta->>'metadata', '');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  v_id uuid;
  v_parent_id uuid;
  v_acl_id uuid;
  v_active bool;
  v_qal_quest_id uuid;
  v_qal_visible boolean;
BEGIN
  raise log '[v0_to_v1] start meta=% is_v0=% ops_count=%',
    v_meta,
    v_version_is_v0,
    coalesce(array_length(p_ops,1),0);

  FOREACH op IN ARRAY p_ops LOOP
    raise log '[v0_to_v1] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    IF v_version_is_v0 AND lower(op.table_name) = 'translation' THEN
      -- Gather IDs / derived fields
      BEGIN v_id := (op.record->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_id := gen_random_uuid(); END;
      BEGIN v_parent_id := (op.record->>'asset_id')::uuid; EXCEPTION WHEN OTHERS THEN v_parent_id := null; END;
      v_acl_id := gen_random_uuid();
      v_active := coalesce((op.record->>'active')::boolean, true);

      raise log '[v0_to_v1] translation map: new_variant_asset_id=% parent_asset_id=% acl_id=% active=%',
        v_id, v_parent_id, v_acl_id, v_active;

      -- 1) asset (variant row)
      new_ops := new_ops || (row(
        'asset',
        CASE WHEN lower(op.op) = 'delete' THEN 'delete' ELSE 'put' END,
        jsonb_build_object(
          'id', v_id,
          'source_asset_id', v_parent_id,
          'active', v_active,
          'visible', coalesce((op.record->>'visible')::boolean, true),
          'creator_id', (op.record->>'creator_id')::uuid,
          'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb),
          'created_at', op.record->>'created_at',
          'last_updated', op.record->>'last_updated'
        )
      ))::public.mutation_op;

      -- 2) asset_content_link (text, lang binding) for put/patch
      -- Note: languoid_id will be added by v1_to_v2 transform
      IF lower(op.op) IN ('put','patch','update') THEN
        new_ops := new_ops || (row(
          'asset_content_link',
          'put',
          (
            (op.record - 'target_language_id' - 'asset_id' - 'creator_id' - 'visible')
            || jsonb_build_object(
                'id', v_acl_id::text,
                'asset_id', v_id::text,
                'source_language_id', op.record->>'target_language_id'
              )
          )
        ))::public.mutation_op;
      END IF;

      -- 3) quest_asset_link for each quest that currently links the parent asset
      -- Mirrors logic in 20251008120001_modernize_schema_structure.sql Step 3
      FOR v_qal_quest_id, v_qal_visible IN
        SELECT qal.quest_id, qal.visible
        FROM public.quest_asset_link qal
        WHERE qal.asset_id = v_parent_id AND qal.active = true
      LOOP
        new_ops := new_ops || (row(
          'quest_asset_link',
          'put',
          jsonb_build_object(
            'quest_id', v_qal_quest_id::text,
            'asset_id', v_id::text,
            'active', v_active,
            'created_at', op.record->>'created_at',
            'last_updated', op.record->>'last_updated',
            'visible', v_qal_visible,
            'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb)
          )
        ))::public.mutation_op;
      END LOOP;

      raise log '[v0_to_v1] translation produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    ELSIF v_version_is_v0 AND lower(op.table_name) = 'vote' THEN
      -- Legacy vote -> asset_vote mapping (unchanged)
      DECLARE v_vote_id uuid; BEGIN v_vote_id := (op.record->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_vote_id := gen_random_uuid(); END;
      raise log '[v0_to_v1] vote map: vote_id=% translation_id=%',
        v_vote_id,
        op.record->>'translation_id';

      new_ops := new_ops || (
        WITH
        t AS (
          SELECT id, asset_id
          FROM public.translation
          WHERE id = (op.record->>'translation_id')::uuid
        ),
        a_variant AS (
          SELECT a.id
          FROM public.asset a
          JOIN t ON a.id = t.id
        )
        SELECT (row(
          'asset_vote',
          CASE WHEN lower(op.op) = 'delete' THEN 'delete' ELSE 'put' END,
          (
            op.record
            || jsonb_build_object(
                 'asset_id', coalesce(
                                (SELECT id FROM a_variant),
                                (SELECT asset_id FROM t)
                              )::text
               )
            - 'translation_id'
          )
        ))::public.mutation_op
      );

      raise log '[v0_to_v1] vote produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    ELSE
      -- passthrough
      out_ops := out_ops || op;
    END IF;
  END LOOP;

  raise log '[v0_to_v1] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  RETURN out_ops;
END;
$$;

-- ============================================================================
-- STEP 6: Update apply_table_mutation to chain transforms
-- ============================================================================
-- v0 data → v0_to_v1 → v1_to_v2
-- v1 data → v1_to_v2
-- v2+ data → passthrough

CREATE OR REPLACE FUNCTION public.apply_table_mutation(
  p_op text,
  p_table_name text,
  p_record jsonb,
  p_client_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  target_schema_name text := 'public';
  v_logs text := '';
  v_meta text := coalesce(p_client_meta->>'schema_version', '0');
  v_version_is_v0 boolean := (v_meta = '0') OR (v_meta LIKE '0.%');
  v_version_is_v1 boolean := (v_meta = '1') OR (v_meta LIKE '1.%');
  ops public.mutation_op[] := ARRAY[(row(p_table_name, lower(p_op), p_record))::public.mutation_op];
  final_ops public.mutation_op[];
  t text; o text; r jsonb;
BEGIN
  -- Validate required inputs
  IF p_op IS NULL OR p_table_name IS NULL THEN
    RAISE EXCEPTION 'apply_table_mutation: op and table_name are required';
  END IF;

  p_op := lower(p_op);

  -- Log inputs
  raise log '[apply_table_mutation] input op=% table=% meta=% record=%',
    p_op, p_table_name, v_meta, p_record::text;

  raise log '[apply_table_mutation] v_is_v0=% v_is_v1=% full_meta=%',
    v_version_is_v0, v_version_is_v1, v_meta;

  v_logs := v_logs
    || format('[input] op=%s table=%s meta=%s record=%s\n', p_op, p_table_name, v_meta, p_record::text)
    || format('[debug] v_is_v0=%s v_is_v1=%s lower(table)=%s\n',
         CASE WHEN v_version_is_v0 THEN 'true' ELSE 'false' END,
         CASE WHEN v_version_is_v1 THEN 'true' ELSE 'false' END,
         lower(p_table_name)
       );

  -- Versioned transform chain
  IF v_version_is_v0 THEN
    -- v0 → v0_to_v1 → v1_to_v2
    ops := public.v0_to_v1(ops, p_client_meta);
    v_logs := v_logs || '[transform] v0_to_v1 applied\n';

    raise log '[apply_table_mutation] after v0_to_v1 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
    
    -- v0_to_v1 now includes languoid_id, but apply v1_to_v2 for any edge cases
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
       
  ELSIF v_version_is_v1 THEN
    -- v1 → v1_to_v2
    ops := public.v1_to_v2(ops, p_client_meta);
    v_logs := v_logs || '[transform] v1_to_v2 applied\n';

    raise log '[apply_table_mutation] after v1_to_v2 transform ops=%',
      (SELECT string_agg(format('(%s %s %s)', x.table_name, x.op, x.record::text), ' | ')
       FROM unnest(ops) x);
  END IF;
  -- v2+ data passes through unchanged

  final_ops := ops;

  -- Execute each resulting op
  FOR t, o, r IN
    SELECT (x).table_name, (x).op, (x).record
    FROM unnest(final_ops) AS x
  LOOP
    raise log '[apply_table_mutation] executing op=% table=% record=%', o, t, r::text;

    v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);

    PERFORM public._apply_single_json_dml(o, t, r);
  END LOOP;

  raise log '[apply_table_mutation] complete. aggregated logs=%', v_logs;

  RETURN v_logs;
END;
$$;

-- ============================================================================
-- STEP 7: Update apply_table_mutation_transaction to chain transforms
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_table_mutation_transaction(
  p_ops jsonb,
  p_default_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  -- logging
  v_logs text := '';
  -- arrays of ops
  inbound_ops jsonb[] := '{}';
  staged_ops public.mutation_op[] := '{}';
  final_ops public.mutation_op[] := '{}';
  -- loop vars for execution
  t text; o text; r jsonb;
  -- error classification
  v_sqlstate text;
  v_status text := '2xx';
  v_ref_code text := null;
  v_error_code text := null;
  v_error_message text := null;
  v_failed_op jsonb := null;
  -- helpers
  v_meta text;
  elem jsonb;
  op_table text;
  op_name text;
  op_record jsonb;
  op_client_meta jsonb;
  v_op_count int := 0;
  v_version_is_v0 boolean;
  v_version_is_v1 boolean;
  v_transformed_ops public.mutation_op[];
BEGIN
  IF p_ops IS NULL OR jsonb_typeof(p_ops) <> 'array' THEN
    RAISE EXCEPTION 'apply_table_mutation_transaction: p_ops must be a json array';
  END IF;

  -- stage inbound ops in order
  FOR elem IN SELECT jsonb_array_elements(p_ops)
  LOOP
    inbound_ops := array_append(inbound_ops, elem);
  END LOOP;

  -- transform/build final ops list
  FOREACH elem IN ARRAY inbound_ops
  LOOP
    op_table := coalesce(elem->>'table_name', elem->>'table');
    op_name := lower(coalesce(elem->>'op', ''));
    op_record := coalesce(elem->'record', '{}'::jsonb);
    op_client_meta := coalesce(elem->'client_meta', p_default_meta);
    v_meta := coalesce(op_client_meta->>'schema_version', '0');
    v_version_is_v0 := (v_meta = '0') OR (v_meta LIKE '0.%');
    v_version_is_v1 := (v_meta = '1') OR (v_meta LIKE '1.%');

    IF op_table IS NULL OR op_name = '' THEN
      RAISE EXCEPTION 'apply_table_mutation_transaction: each elem requires table_name and op';
    END IF;

    -- build a single mutation_op
    staged_ops := ARRAY[(row(op_table, op_name, op_record))::public.mutation_op];

    -- Apply transform chain based on version
    IF v_version_is_v0 THEN
      -- v0 → v0_to_v1 → v1_to_v2
      v_transformed_ops := public.v0_to_v1(staged_ops, op_client_meta);
      v_transformed_ops := public.v1_to_v2(v_transformed_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v0_to_v1 + v1_to_v2 applied for %s %s\n', op_table, op_name);
    ELSIF v_version_is_v1 THEN
      -- v1 → v1_to_v2
      v_transformed_ops := public.v1_to_v2(staged_ops, op_client_meta);
      v_logs := v_logs || format('[transform] v1_to_v2 applied for %s %s\n', op_table, op_name);
    ELSE
      -- v2+ passthrough
      v_transformed_ops := staged_ops;
    END IF;
    
    final_ops := final_ops || v_transformed_ops;
  END LOOP;

  v_op_count := array_length(final_ops, 1);
  v_logs := v_logs || format('[summary] total_ops=%s\n', coalesce(v_op_count, 0));

  -- execute in a sub-transaction to allow catching and classifying errors
  BEGIN
    FOR t, o, r IN
      SELECT (x::public.mutation_op).table_name, (x::public.mutation_op).op, (x::public.mutation_op).record 
      FROM unnest(final_ops) AS x
    LOOP
      v_logs := v_logs || format('[exec] %s %s %s\n', o, t, r::text);
      v_failed_op := jsonb_build_object('op', o, 'table', t, 'record', r);
      PERFORM public._apply_single_json_dml(o, t, r);
      v_failed_op := null; -- clear on success
    END LOOP;
    v_status := '2xx';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_sqlstate = returned_sqlstate,
      v_error_message = message_text;
    v_error_code := v_sqlstate;

    -- classify
    IF (v_sqlstate ~ '^22...$') OR (v_sqlstate ~ '^23...$') OR (v_sqlstate = '42501') OR (v_sqlstate = '23505') THEN
      v_status := '4xx';
    ELSE
      v_status := '5xx';
    END IF;

    v_logs := v_logs || format('[error] sqlstate=%s message=%s\n', v_sqlstate, coalesce(v_error_message, ''));

    IF v_status = '4xx' THEN
      -- generate 6-digit ref code
      v_ref_code := lpad((floor(random()*1000000))::int::text, 6, '0');

      -- persist each ORIGINAL inbound op (not transformed) to inbox
      FOREACH elem IN ARRAY inbound_ops
      LOOP
        INSERT INTO public.upload_inbox (data, logs, error_code, ref_code)
        VALUES (elem, v_logs, v_error_code, v_ref_code);
      END LOOP;
    END IF;
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'logs', v_logs,
    'ref_code', v_ref_code,
    'error_code', v_error_code,
    'error_message', v_error_message,
    'failed_op', v_failed_op,
    'op_count', v_op_count,
    'ops_summary', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', op_elem->>'table_name',
          'op', op_elem->>'op',
          'has_record', (op_elem ? 'record')
        )
      )
      FROM jsonb_array_elements(p_ops) AS op_elem
    )
  );
END;
$$;

-- ============================================================================
-- Add table to PowerSync publication (if not already added)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'powersync' AND tablename = 'language_languoid_map'
  ) THEN
    ALTER PUBLICATION powersync ADD TABLE public.language_languoid_map;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication might not exist yet, ignore
  NULL;
END $$;

