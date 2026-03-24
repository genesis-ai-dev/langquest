/**
 * Upsert chapter-level Bible audio timestamps into public.bible_audio_timestamp.
 *
 * Env: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Loads .env.local from project root when present (does not override existing env).
 *
 * Usage:
 *   npm run import-timestamps -- --file data/timestamps/luke_timestamps.json --fileset FRNPDVN2DA --bible FRAPDVA --book LUK
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

type RawVerse = { v: number; start: number };
type RawFile = Record<string, RawVerse[]>;

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--file' || a === '-f') out.file = argv[++i] ?? '';
    else if (a === '--fileset') out.fileset = argv[++i] ?? '';
    else if (a === '--bible') out.bible = argv[++i] ?? '';
    else if (a === '--book' || a === '-b') out.book = argv[++i] ?? '';
  }
  return out;
}

async function main() {
  loadEnvLocal();

  const args = parseArgs();
  if (!args.file || !args.fileset || !args.book) {
    console.error(
      'Usage: import-timestamps --file <path> --fileset <audio_fileset_id> --book <USFM_BOOK> [--bible <bible_abbr>]'
    );
    process.exit(1);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }

  const filePath = path.isAbsolute(args.file)
    ? args.file
    : path.join(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const bookId = args.book.toUpperCase();
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RawFile;

  const supabase = createClient(supabaseUrl, serviceKey);

  let ok = 0;
  let fail = 0;

  for (const [chapterKey, verses] of Object.entries(raw)) {
    const chapter = parseInt(chapterKey, 10);
    if (!Number.isFinite(chapter) || !Array.isArray(verses)) {
      console.warn(`Skip invalid chapter key: ${chapterKey}`);
      fail++;
      continue;
    }

    const timestamps = verses.map((row) => ({
      verseStart: row.v,
      timestamp: row.start
    }));

    const { error } = await supabase.from('bible_audio_timestamp').upsert(
      {
        audio_fileset_id: args.fileset,
        bible_id: args.bible ?? null,
        book_id: bookId,
        chapter,
        timestamps,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'audio_fileset_id,book_id,chapter' }
    );

    if (error) {
      console.error(`Chapter ${chapter}: ${error.message}`);
      fail++;
    } else {
      console.log(`Chapter ${chapter}: upserted (${timestamps.length} verses)`);
      ok++;
    }
  }

  console.log(`Done. ${ok} chapters ok, ${fail} failed/skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
