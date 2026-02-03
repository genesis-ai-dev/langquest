-- Enable Nepali as a UI-ready language
-- The languoid record already exists in production with id: 7a735df4-4f4e-4a03-b60e-eb7911152cf4
-- ISO 639-3: npi (Nepali language, not the macrolanguage nep)
-- 
-- In local dev, the languoid is created by seeds (which run AFTER migrations),
-- so we use conditional statements that only execute if the languoid exists.

UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE id = '7a735df4-4f4e-4a03-b60e-eb7911152cf4';

-- Add Nepali endonymic alias (नेपाली) - only if the languoid exists (production)
-- Both subject and label reference Nepali since it's an endonym (self-name)
-- In local dev, seeds handle creating this alias
INSERT INTO public.languoid_alias (
    subject_languoid_id,
    label_languoid_id,
    name,
    alias_type,
    source_names
)
SELECT
    '7a735df4-4f4e-4a03-b60e-eb7911152cf4',
    '7a735df4-4f4e-4a03-b60e-eb7911152cf4',
    'नेपाली',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '7a735df4-4f4e-4a03-b60e-eb7911152cf4'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;
