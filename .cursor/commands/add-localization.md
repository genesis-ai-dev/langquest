Add localization support for @language.

---

Use PR #707 (Caleb/localize nepali) as the scope pattern, but keep this focused on language onboarding only.

Only required input: `@language` (English name).  
Infer missing metadata (endonym, ISO 639-3, locale). If ambiguous, ask one concise clarification question.

## Files to update

- `services/localizations.ts`
- `hooks/useLocalization.ts`
- `db/seedData.json`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-email/_templates/confirm-email.tsx`
- `supabase/functions/send-email/_templates/invite-email.tsx`
- `supabase/functions/send-email/_templates/reset-password.tsx`
- `supabase/migrations/YYYYMMDDHHmmss_add_<language>_ui_ready.sql`

## Required changes

1. Add the language to `SupportedLanguage` and `SUPPORTED_LANGUAGE_NAMES` in `services/localizations.ts` (include English name + endonym aliases).
2. Add translations for the new language across `localizations` in `services/localizations.ts` while preserving interpolation placeholders exactly (`{value}`, `{count}`, etc.).
3. Update `mapLanguoidNameToSupportedLanguage()` in `hooks/useLocalization.ts` for English name and endonym mapping.
4. Add locale content to all three email templates.
5. Update `supabase/functions/send-email/index.ts`:
   - subject mappings for signup/recovery/invite
   - locale mapping in `mapLanguoidNameToLocale()` (English name + endonym)
6. Update `db/seedData.json` with:
   - a `languoid` entry (`id: lang-<iso3>`, `ui_ready: true`, `active: true`)
   - an endonym alias (`id: alias-<iso3>-endonym`, `source_names: ["lexvo"]`)
   - an ISO source (`id: lsrc-<iso3>-iso`, `unique_identifier: <iso3>`)
7. Add an idempotent migration that:
   - sets `languoid.ui_ready = true` for the language (match by name + ISO source)
   - inserts the endonym alias with `on conflict ... do nothing`

## Guardrails

- Do not add unrelated product/UI features.
- Keep changes localized to onboarding this language.
- Preserve existing formatting/style in each edited file.

## Validation

- Confirm the new language key exists consistently across all touched files.
- Run `npm run typecheck`.
- Report inferred metadata (endonym, iso3, locale) and changed files.
