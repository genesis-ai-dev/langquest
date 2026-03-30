# Bible audio timestamps (source files)

JSON files here are **committed to git** — generated verse-level start times (seconds) per chapter, keyed by chapter number.

Import into Supabase after migrations:

```bash
npm run import-timestamps -- \
  --file data/timestamps/luke_timestamps.json \
  --fileset FRNPDVN2DA \
  --bible FRAPDVA \
  --book LUK
```

Use `.env.local` (or env vars) for `EXPO_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
