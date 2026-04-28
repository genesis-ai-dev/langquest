import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js';

// --- Constants ---

const BIBLE_BRAIN_API = 'https://4.dbt.io/api';

function getSupabase() {
  const url = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const key = Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

const TEXT_TYPES = ['text_plain', 'text_format'];
const AUDIO_TYPES = ['audio_drama', 'audio'];
const TESTAMENT_SIZES: Record<string, string[]> = {
  OT: ['C', 'OT', 'OTP', 'OTNTP', 'NTPOTP', 'S'],
  NT: ['C', 'NT', 'NTP', 'NTOTP', 'NTPOTP', 'S']
};

// --- Types ---

interface ListBiblesRequest {
  action: 'list-bibles';
  iso639_3: string;
}

interface ListLanguagesRequest {
  action: 'list-languages';
  search: string;
}

interface GetContentRequest {
  action: 'get-content';
  bibleId: string;
  bookId: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

type RequestBody = ListBiblesRequest | ListLanguagesRequest | GetContentRequest;

type Testament = 'OT' | 'NT';

interface BibleEntry {
  id: string;
  name: string;
  vname: string | null;
  hasText: boolean;
  hasAudio: boolean;
  textTestaments: Testament[];
  audioTestaments: Testament[];
  iso: string;
  languageName: string;
}

// --- Bible Brain API helpers ---

function bbUrl(path: string, params: Record<string, string> = {}): string {
  const key = Deno.env.get('BIBLE_BRAIN_ACCESS_KEY');
  const url = new URL(`${BIBLE_BRAIN_API}${path}`);
  url.searchParams.set('v', '4');
  url.searchParams.set('key', key ?? '');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function bbFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = bbUrl(path, params);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bible Brain ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// --- Fileset selection ---

function guessTestament(bookId: string): 'OT' | 'NT' {
  const ntBooks = new Set([
    'MAT',
    'MRK',
    'LUK',
    'JHN',
    'ACT',
    'ROM',
    '1CO',
    '2CO',
    'GAL',
    'EPH',
    'PHP',
    'COL',
    '1TH',
    '2TH',
    '1TI',
    '2TI',
    'TIT',
    'PHM',
    'HEB',
    'JAS',
    '1PE',
    '2PE',
    '1JN',
    '2JN',
    '3JN',
    'JUD',
    'REV'
  ]);
  return ntBooks.has(bookId.toUpperCase()) ? 'NT' : 'OT';
}

// deno-lint-ignore no-explicit-any
function pickBestFileset(
  filesets: any[],
  types: string[],
  bookId?: string
): string | null {
  const validSizes = bookId
    ? (TESTAMENT_SIZES[guessTestament(bookId)] ?? [])
    : ['C', 'NT', 'OT', 'NTP', 'OTP', 'NTPOTP', 'OTNTP', 'S'];

  for (const t of types) {
    const matching = filesets.filter(
      // deno-lint-ignore no-explicit-any
      (f: any) => f.type === t && validSizes.includes(f.size)
    );
    if (matching.length > 0) {
      // Prefer non-opus variants (opus16 re-encodes lack timestamp data)
      // deno-lint-ignore no-explicit-any
      const nonOpus = matching.filter((f: any) => !f.id.includes('-opus'));
      const candidates = nonOpus.length > 0 ? nonOpus : matching;
      const complete = candidates.find((f: { size: string }) => f.size === 'C');
      return (complete ?? candidates[0]).id;
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
function coveredTestaments(filesets: any[], types: string[]): Testament[] {
  const result: Testament[] = [];
  for (const testament of ['OT', 'NT'] as const) {
    const valid = TESTAMENT_SIZES[testament];
    const has = types.some((t) =>
      // deno-lint-ignore no-explicit-any
      filesets.some((f: any) => f.type === t && valid.includes(f.size))
    );
    if (has) result.push(testament);
  }
  return result;
}

type VerseTimestamp = { verseStart: number; timestamp: number };

async function getCustomTimestamps(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  audioFilesetId: string,
  bookId: string,
  chapter: number
): Promise<VerseTimestamp[] | null> {
  const { data, error } = await supabase
    .from('bible_audio_timestamp')
    .select('timestamps')
    .eq('audio_fileset_id', audioFilesetId)
    .eq('book_id', bookId)
    .eq('chapter', chapter)
    .maybeSingle();

  if (error) {
    console.error('bible_audio_timestamp lookup failed:', error.message);
    return null;
  }

  const raw = data?.timestamps;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const mapped: VerseTimestamp[] = [];
  for (const row of raw) {
    // deno-lint-ignore no-explicit-any
    const r = row as any;
    const verseStart =
      typeof r.verseStart === 'number'
        ? r.verseStart
        : typeof r.verse_start === 'number'
          ? r.verse_start
          : NaN;
    const timestamp = typeof r.timestamp === 'number' ? r.timestamp : NaN;
    if (!Number.isFinite(verseStart) || !Number.isFinite(timestamp)) continue;
    mapped.push({ verseStart, timestamp });
  }

  return mapped.length > 0 ? mapped : null;
}

// --- Action: list-bibles ---

async function handleListBibles(iso639_3: string): Promise<Response> {
  // Fetch bibles and language info in parallel so we always have a name
  const [biblesData, langData] = await Promise.all([
    // deno-lint-ignore no-explicit-any
    bbFetch<any>('/bibles', { language_code: iso639_3, limit: '50' }),
    // deno-lint-ignore no-explicit-any
    bbFetch<any>('/languages', { language_code: iso639_3 }).catch(() => ({
      data: []
    }))
  ]);

  const langEntries = langData.data ?? [];
  // deno-lint-ignore no-explicit-any
  const langName = langEntries[0]?.name || langEntries[0]?.autonym || '';

  // deno-lint-ignore no-explicit-any
  const bibles: BibleEntry[] = (biblesData.data ?? []).map((b: any) => {
    const filesets = b.filesets?.['dbp-prod'] ?? [];
    const textTestaments = coveredTestaments(filesets, TEXT_TYPES);
    const audioTestaments = coveredTestaments(filesets, AUDIO_TYPES);

    return {
      id: b.abbr,
      name: b.name ?? '',
      vname: b.vname ?? null,
      hasText: textTestaments.length > 0,
      hasAudio: audioTestaments.length > 0,
      textTestaments,
      audioTestaments,
      iso: b.iso ?? iso639_3,
      languageName: b.language || b.autonym || langName || b.iso || iso639_3
    };
  });

  bibles.sort((a, b) => {
    const scoreA = (a.hasText ? 2 : 0) + (a.hasAudio ? 1 : 0);
    const scoreB = (b.hasText ? 2 : 0) + (b.hasAudio ? 1 : 0);
    return scoreB - scoreA;
  });

  return jsonResponse({ bibles });
}

// --- Action: list-languages ---

async function handleListLanguages(search: string): Promise<Response> {
  // deno-lint-ignore no-explicit-any
  const data: any = await bbFetch(
    `/languages/search/${encodeURIComponent(search)}`
  );
  const items = data.data ?? [];

  // deno-lint-ignore no-explicit-any
  const languages = items.map((l: any) => ({
    iso: l.iso ?? '',
    name: l.name ?? '',
    autonym: l.autonym ?? ''
  }));

  return jsonResponse({ languages });
}

// --- Action: get-content ---

async function handleGetContent(body: GetContentRequest): Promise<Response> {
  const { bibleId, bookId, startChapter, startVerse, endChapter, endVerse } =
    body;
  const book = bookId.toUpperCase();

  // Resolve filesets server-side from the bible's metadata
  // deno-lint-ignore no-explicit-any
  const bibleData: any = await bbFetch(`/bibles/${bibleId}`);
  const filesets = bibleData?.data?.filesets?.['dbp-prod'] ?? [];
  const textFilesetId = pickBestFileset(filesets, TEXT_TYPES, book);
  const audioFilesetId = pickBestFileset(filesets, AUDIO_TYPES, book);

  const chapters: number[] = [];
  for (let c = startChapter; c <= endChapter; c++) {
    chapters.push(c);
  }

  // deno-lint-ignore no-explicit-any
  let verses: any[] = [];
  if (textFilesetId) {
    const textPromises = chapters.map(async (ch) => {
      const params: Record<string, string> = {};
      if (ch === startChapter && startVerse > 1)
        params.verse_start = String(startVerse);
      if (ch === endChapter) params.verse_end = String(endVerse);

      try {
        // deno-lint-ignore no-explicit-any
        const res: any = await bbFetch(
          `/bibles/filesets/${textFilesetId}/${book}/${ch}`,
          params
        );
        return res.data ?? res ?? [];
      } catch {
        return [];
      }
    });

    const textResults = await Promise.all(textPromises);
    for (const result of textResults) {
      // deno-lint-ignore no-explicit-any
      const filtered = (Array.isArray(result) ? result : []).filter(
        (v: any) => {
          const ch = v.chapter ?? v.chapter_start;
          const vs = v.verse_start ?? v.verse_sequence;
          if (ch === startChapter && vs < startVerse) return false;
          if (ch === endChapter && vs > endVerse) return false;
          return true;
        }
      );
      // deno-lint-ignore no-explicit-any
      verses = verses.concat(
        filtered.map((v: any) => ({
          chapter: v.chapter ?? v.chapter_start,
          verseStart: v.verse_start ?? v.verse_sequence,
          verseText: v.verse_text ?? ''
        }))
      );
    }
  }

  interface AudioChapter {
    chapter: number;
    url: string;
    duration: number;
    timestamps?: Array<{ verseStart: number; timestamp: number }>;
  }
  const audio: AudioChapter[] = [];
  const supabase = getSupabase();

  if (audioFilesetId) {
    const audioPromises = chapters.map(
      async (ch): Promise<AudioChapter | null> => {
        try {
          // deno-lint-ignore no-explicit-any
          const res: any = await bbFetch(
            `/bibles/filesets/${audioFilesetId}/${book}/${ch}`
          );
          const items = res.data ?? res ?? [];
          if (!Array.isArray(items) || items.length === 0) return null;

          const item = items[0];
          const entry: AudioChapter = {
            chapter: ch,
            url: item.path,
            duration: item.duration ?? 0
          };

          // Timestamps: prefer custom DB rows, then Bible Brain API
          let tsList: VerseTimestamp[] | null = null;
          if (supabase) {
            tsList = await getCustomTimestamps(
              supabase,
              audioFilesetId,
              book,
              ch
            );
          }
          if (tsList) {
            entry.timestamps = tsList;
          } else {
            try {
              // deno-lint-ignore no-explicit-any
              const tsRes: any = await bbFetch(
                `/timestamps/${audioFilesetId}/${book}/${ch}`
              );
              const tsData = tsRes.data ?? [];
              if (Array.isArray(tsData) && tsData.length > 0) {
                // deno-lint-ignore no-explicit-any
                entry.timestamps = tsData.map((t: any) => ({
                  verseStart: parseInt(t.verse_start, 10),
                  timestamp: t.timestamp
                }));
              }
            } catch {
              // Timestamps not available for this fileset
            }
          }

          return entry;
        } catch {
          return null;
        }
      }
    );

    const audioResults = await Promise.all(audioPromises);
    for (const result of audioResults) {
      if (result) audio.push(result);
    }
  }

  // Fetch copyright from the best available fileset (prefer text, fallback to audio)
  const copyrightFilesetId = textFilesetId ?? audioFilesetId;
  let copyright: {
    copyright: string;
    copyrightDate: string | null;
    organizations: Array<{
      name: string;
      logoUrl: string | null;
      url: string | null;
    }>;
  } | null = null;

  if (copyrightFilesetId) {
    try {
      // deno-lint-ignore no-explicit-any
      const crRes: any = await bbFetch(
        `/bibles/filesets/${copyrightFilesetId}/copyright`
      );
      const crData = crRes?.copyright;
      if (crData) {
        // deno-lint-ignore no-explicit-any
        const orgs = (crData.organizations ?? []).map((org: any) => {
          const name =
            org.translations?.[0]?.name ?? org.slug?.replace(/-/g, ' ') ?? '';
          const logos = org.logos ?? [];
          // deno-lint-ignore no-explicit-any
          const logoEntry = logos.find((l: any) => l.icon === 0) ?? logos[0];
          return {
            name,
            logoUrl: logoEntry?.url ?? null,
            url: org.url_site ?? null
          };
        });

        copyright = {
          copyright: crData.copyright ?? '',
          copyrightDate: crData.copyright_date ?? null,
          organizations: orgs
        };
      }
    } catch {
      // Copyright not critical — continue without it
    }
  }

  return jsonResponse({ verses, audio, copyright });
}

// --- Utilities ---

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const apiKey = Deno.env.get('BIBLE_BRAIN_ACCESS_KEY');
    if (!apiKey) {
      console.error('BIBLE_BRAIN_ACCESS_KEY not set');
      return errorResponse('Bible Brain API key not configured', 500);
    }

    const body: RequestBody = await req.json();

    if (body.action === 'list-bibles') {
      if (!body.iso639_3) {
        return errorResponse('Missing required field: iso639_3', 400);
      }
      return await handleListBibles(body.iso639_3);
    }

    if (body.action === 'list-languages') {
      if (!body.search || body.search.length < 2) {
        return errorResponse('Search query must be at least 2 characters', 400);
      }
      return await handleListLanguages(body.search);
    }

    if (body.action === 'get-content') {
      if (!body.bibleId) {
        return errorResponse('Missing required field: bibleId', 400);
      }
      if (!body.bookId || !body.startChapter || !body.endChapter) {
        return errorResponse(
          'Missing required fields: bookId, startChapter, endChapter',
          400
        );
      }
      return await handleGetContent(body);
    }

    return errorResponse(
      `Unknown action: ${(body as { action?: string }).action}`,
      400
    );
  } catch (error) {
    console.error('Error in bible-brain-content function:', error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
});
