import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// --- Constants ---

const BIBLE_BRAIN_API = 'https://4.dbt.io/api';

const TEXT_TYPES = ['text_plain', 'text_format'];
const AUDIO_TYPES = ['audio_drama', 'audio'];
const TESTAMENT_SIZES: Record<string, string[]> = {
  OT: ['C', 'OT', 'OTP', 'OTNTP', 'NTPOTP', 'S'],
  NT: ['C', 'NT', 'NTP', 'NTOTP', 'NTPOTP', 'S'],
};

// --- Types ---

interface ListBiblesRequest {
  action: 'list-bibles';
  iso639_3: string;
}

interface GetContentRequest {
  action: 'get-content';
  textFilesetId: string | null;
  audioFilesetId: string | null;
  bookId: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

type RequestBody = ListBiblesRequest | GetContentRequest;

interface BibleEntry {
  id: string;
  name: string;
  vname: string | null;
  hasText: boolean;
  hasAudio: boolean;
  textFilesetId: string | null;
  audioFilesetId: string | null;
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

async function bbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
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
    'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
    'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
    '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
  ]);
  return ntBooks.has(bookId.toUpperCase()) ? 'NT' : 'OT';
}

// deno-lint-ignore no-explicit-any
function pickBestFileset(filesets: any[], types: string[], bookId?: string): string | null {
  const validSizes = bookId
    ? TESTAMENT_SIZES[guessTestament(bookId)] ?? []
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

// --- Action: list-bibles ---

async function handleListBibles(iso639_3: string): Promise<Response> {
  // deno-lint-ignore no-explicit-any
  const data: any = await bbFetch('/bibles', {
    language_code: iso639_3,
    limit: '50',
  });

  // deno-lint-ignore no-explicit-any
  const bibles: BibleEntry[] = (data.data ?? []).map((b: any) => {
    const filesets = b.filesets?.['dbp-prod'] ?? [];
    const textId = pickBestFileset(filesets, TEXT_TYPES);
    const audioId = pickBestFileset(filesets, AUDIO_TYPES);

    return {
      id: b.abbr,
      name: b.name ?? '',
      vname: b.vname ?? null,
      hasText: textId !== null,
      hasAudio: audioId !== null,
      textFilesetId: textId,
      audioFilesetId: audioId,
    };
  });

  bibles.sort((a, b) => {
    const scoreA = (a.hasText ? 2 : 0) + (a.hasAudio ? 1 : 0);
    const scoreB = (b.hasText ? 2 : 0) + (b.hasAudio ? 1 : 0);
    return scoreB - scoreA;
  });

  return jsonResponse({ bibles });
}

// --- Action: get-content ---

async function handleGetContent(body: GetContentRequest): Promise<Response> {
  const { textFilesetId, audioFilesetId, bookId, startChapter, startVerse, endChapter, endVerse } = body;
  const book = bookId.toUpperCase();

  // Build chapter list
  const chapters: number[] = [];
  for (let c = startChapter; c <= endChapter; c++) {
    chapters.push(c);
  }

  // Fetch text for each chapter in parallel
  // deno-lint-ignore no-explicit-any
  let verses: any[] = [];
  if (textFilesetId) {
    const textPromises = chapters.map(async (ch) => {
      const params: Record<string, string> = {};
      if (ch === startChapter && startVerse > 1) params.verse_start = String(startVerse);
      if (ch === endChapter) params.verse_end = String(endVerse);

      try {
        // deno-lint-ignore no-explicit-any
        const res: any = await bbFetch(`/bibles/filesets/${textFilesetId}/${book}/${ch}`, params);
        return (res.data ?? res ?? []);
      } catch {
        return [];
      }
    });

    const textResults = await Promise.all(textPromises);
    for (const result of textResults) {
      // deno-lint-ignore no-explicit-any
      const filtered = (Array.isArray(result) ? result : []).filter((v: any) => {
        const ch = v.chapter ?? v.chapter_start;
        const vs = v.verse_start ?? v.verse_sequence;
        if (ch === startChapter && vs < startVerse) return false;
        if (ch === endChapter && vs > endVerse) return false;
        return true;
      });
      // deno-lint-ignore no-explicit-any
      verses = verses.concat(filtered.map((v: any) => ({
        chapter: v.chapter ?? v.chapter_start,
        verseStart: v.verse_start ?? v.verse_sequence,
        verseText: v.verse_text ?? '',
      })));
    }
  }

  // Fetch audio + timestamps for each chapter in parallel
  interface AudioChapter {
    chapter: number;
    url: string;
    duration: number;
    timestamps?: Array<{ verseStart: number; timestamp: number }>;
  }
  const audio: AudioChapter[] = [];

  if (audioFilesetId) {
    const audioPromises = chapters.map(async (ch): Promise<AudioChapter | null> => {
      try {
        // deno-lint-ignore no-explicit-any
        const res: any = await bbFetch(`/bibles/filesets/${audioFilesetId}/${book}/${ch}`);
        const items = res.data ?? res ?? [];
        if (!Array.isArray(items) || items.length === 0) return null;

        const item = items[0];
        const entry: AudioChapter = {
          chapter: ch,
          url: item.path,
          duration: item.duration ?? 0,
        };

        // Try to get timestamps
        try {
          // deno-lint-ignore no-explicit-any
          const tsRes: any = await bbFetch(`/timestamps/${audioFilesetId}/${book}/${ch}`);
          const tsData = tsRes.data ?? [];
          if (Array.isArray(tsData) && tsData.length > 0) {
            // deno-lint-ignore no-explicit-any
            entry.timestamps = tsData.map((t: any) => ({
              verseStart: parseInt(t.verse_start, 10),
              timestamp: t.timestamp,
            }));
          }
        } catch {
          // Timestamps not available for this fileset
        }

        return entry;
      } catch {
        return null;
      }
    });

    const audioResults = await Promise.all(audioPromises);
    for (const result of audioResults) {
      if (result) audio.push(result);
    }
  }

  return jsonResponse({ verses, audio });
}

// --- Utilities ---

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
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
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
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

    if (body.action === 'get-content') {
      if (!body.textFilesetId && !body.audioFilesetId) {
        return errorResponse('At least one of textFilesetId or audioFilesetId is required', 400);
      }
      if (!body.bookId || !body.startChapter || !body.endChapter) {
        return errorResponse('Missing required fields: bookId, startChapter, endChapter', 400);
      }
      return await handleGetContent(body);
    }

    return errorResponse(`Unknown action: ${(body as { action?: string }).action}`, 400);
  } catch (error) {
    console.error('Error in bible-brain-content function:', error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
});
