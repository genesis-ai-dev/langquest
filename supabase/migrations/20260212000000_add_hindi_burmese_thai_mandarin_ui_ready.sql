-- Enable Hindi, Burmese, Thai, and Mandarin as UI-ready languages
-- These languoid records may already exist in production with different IDs
-- ISO 639-3 codes: hin (Hindi), mya (Burmese), tha (Thai), cmn (Mandarin)
-- 
-- In local dev, the languoids are created by seeds (which run AFTER migrations),
-- so we use conditional statements that only execute if the languoid exists.

-- Enable Hindi (हिन्दी)
UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE name = 'Hindi'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'hin'
  );

-- Add Hindi endonymic alias (हिन्दी)
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    languoid.id,
    languoid.id,
    'हिन्दी',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
FROM public.languoid
WHERE name = 'Hindi'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'hin'
  )
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- Enable Burmese (မြန်မာ)
UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE name = 'Burmese'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'mya'
  );

-- Add Burmese endonymic alias (မြန်မာ)
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    languoid.id,
    languoid.id,
    'မြန်မာ',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
FROM public.languoid
WHERE name = 'Burmese'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'mya'
  )
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- Enable Thai (ไทย)
UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE name = 'Thai'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'tha'
  );

-- Add Thai endonymic alias (ไทย)
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    languoid.id,
    languoid.id,
    'ไทย',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
FROM public.languoid
WHERE name = 'Thai'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'tha'
  )
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;

-- Enable Mandarin (普通话)
UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE name = 'Mandarin'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'cmn'
  );

-- Add Mandarin endonymic alias (普通话)
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    languoid.id,
    languoid.id,
    '普通话',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
FROM public.languoid
WHERE name = 'Mandarin'
  AND EXISTS (
    SELECT 1 FROM public.languoid_source 
    WHERE languoid_id = languoid.id 
    AND unique_identifier = 'cmn'
  )
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;
