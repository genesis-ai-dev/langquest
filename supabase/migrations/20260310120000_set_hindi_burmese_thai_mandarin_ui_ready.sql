-- Enable Hindi, Burmese, Thai, and Mandarin as UI-ready languages
-- These languoids already exist in production with specific IDs.
-- The previous migration (20260223232044) added endonymic aliases
-- but did not set ui_ready = true.
--
-- Production IDs:
--   Hindi:    3502e2a1-3cfd-45f7-8167-a9a67d42c76a
--   Burmese:  fa8369a5-03a6-4d1e-ba44-152409a2f97c
--   Thai:     fe361436-f7ff-4955-a442-59b76623b3c9
--   Mandarin: 0d75d06f-2692-4127-b810-67dd64fa6eee
--
-- In local dev, the languoids are created by seeds (which run AFTER migrations),
-- so updates are conditional on the row existing.

UPDATE public.languoid
SET ui_ready = true,
    last_updated = NOW()
WHERE id IN (
    '3502e2a1-3cfd-45f7-8167-a9a67d42c76a',  -- Hindi
    'fa8369a5-03a6-4d1e-ba44-152409a2f97c',  -- Burmese
    'fe361436-f7ff-4955-a442-59b76623b3c9',  -- Thai
    '0d75d06f-2692-4127-b810-67dd64fa6eee'   -- Mandarin
)
AND ui_ready IS NOT TRUE;
