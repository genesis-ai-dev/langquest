-- Enable French as a UI-ready language
-- The languoid record already exists in production with id: 155f40c3-cb64-4fdd-aaf7-a55acb42c755
-- ISO 639-3: npi (French language, not the macrolanguage nep)
-- 
-- In local dev, the languoid is created by seeds (which run AFTER migrations),
-- so we use conditional statements that only execute if the languoid exists.

UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE id = '155f40c3-cb64-4fdd-aaf7-a55acb42c755';

-- Add French endonymic alias (français) - only if the languoid exists (production)
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
    '155f40c3-cb64-4fdd-aaf7-a55acb42c755',
    '155f40c3-cb64-4fdd-aaf7-a55acb42c755', 
    'français',
    'endonym'::public.alias_type,
    ARRAY['lexvo']
WHERE EXISTS (
    SELECT 1 FROM public.languoid WHERE id = '155f40c3-cb64-4fdd-aaf7-a55acb42c755'
)
ON CONFLICT (subject_languoid_id, label_languoid_id, alias_type, name) DO NOTHING;
