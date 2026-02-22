import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// --- Types ---

interface FiaPericopesRequest {
  fiaLanguageCode: string; // e.g. "tpi", "swa", "eng"
}

interface FiaPericope {
  id: string; // e.g. "mrk-p1"
  sequence: number;
  verseRange: string; // e.g. "1:1-13"
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

interface FiaBook {
  id: string; // e.g. "mrk"
  title: string; // Translated book title
  pericopes: FiaPericope[];
}

interface FiaPericopesResponse {
  books: FiaBook[];
}

// --- FIA Auth (token caching) ---

const FIA_AUTH_URL = 'https://auth.fiaproject.org/token';
const FIA_GRAPHQL_URL = 'https://api.fiaproject.org/graphql';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getFiaToken(accessKey: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(FIA_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: accessKey })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FIA auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Cache for 14 minutes (tokens expire at 15 min)
  tokenExpiresAt = now + 14 * 60 * 1000;
  return cachedToken!;
}

// --- GraphQL query ---

const PERICOPES_QUERY = `
  query LanguagePericopes($langId: ID!) {
    language(id: $langId) {
      id
      nameEnglish

      bookTranslations(first: 100) {
        edges {
          node {
            id
            title
            book {
              id
            }

            pericopeTranslations(first: 200) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  pericope {
                    id
                    pId
                    sequence
                    split
                    startChapter
                    startVerse
                    endChapter
                    endVerse
                    verseRangeShort
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Query for additional pericope pages within a book
const PERICOPE_PAGE_QUERY = `
  query BookPericopeTranslations($bookTranslationId: ID!, $after: String) {
    bookTranslation(id: $bookTranslationId) {
      pericopeTranslations(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            pericope {
              id
              pId
              sequence
              split
              startChapter
              startVerse
              endChapter
              endVerse
              verseRangeShort
            }
          }
        }
      }
    }
  }
`;

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

async function fiaGraphQL(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse> {
  const response = await fetch(FIA_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FIA GraphQL request failed (${response.status}): ${text}`);
  }

  return response.json();
}

// deno-lint-ignore no-explicit-any
function mapPericope(node: any): FiaPericope {
  const p = node.pericope;
  return {
    id: p.id,
    sequence: p.sequence,
    verseRange:
      p.verseRangeShort ||
      `${p.startChapter}:${p.startVerse}-${p.endChapter}:${p.endVerse}`,
    startChapter: p.startChapter,
    startVerse: p.startVerse,
    endChapter: p.endChapter,
    endVerse: p.endVerse
  };
}

// --- Main handler ---

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const accessKey = Deno.env.get('FIA_ACCESS_KEY');
    if (!accessKey) {
      console.error('FIA_ACCESS_KEY not set');
      return new Response(
        JSON.stringify({ error: 'FIA API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: FiaPericopesRequest = await req.json();
    if (!body.fiaLanguageCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: fiaLanguageCode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get FIA bearer token
    const token = await getFiaToken(accessKey);

    // Fetch books + pericopes for this language
    const result = await fiaGraphQL(token, PERICOPES_QUERY, {
      langId: body.fiaLanguageCode
    });

    if (result.errors?.length) {
      console.error('FIA GraphQL errors:', result.errors);
      return new Response(
        JSON.stringify({
          error: 'FIA API returned errors',
          details: result.errors.map((e) => e.message)
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const language = (result.data as any)?.language;
    if (!language) {
      return new Response(
        JSON.stringify({
          error: `Language '${body.fiaLanguageCode}' not found in FIA`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize book + pericope data
    const books: FiaBook[] = [];

    // deno-lint-ignore no-explicit-any
    for (const bookEdge of language.bookTranslations?.edges || []) {
      const bookNode = bookEdge.node;
      const bookId: string = bookNode.book.id;
      const bookTitle: string = bookNode.title;

      // Collect initial pericopes
      // deno-lint-ignore no-explicit-any
      const pericopes: FiaPericope[] = bookNode.pericopeTranslations.edges.map(
        (e: any) => mapPericope(e.node)
      );

      // Handle pagination if needed
      let pageInfo = bookNode.pericopeTranslations.pageInfo;
      while (pageInfo.hasNextPage) {
        const pageResult = await fiaGraphQL(token, PERICOPE_PAGE_QUERY, {
          bookTranslationId: bookNode.id,
          after: pageInfo.endCursor
        });

        // deno-lint-ignore no-explicit-any
        const bt = (pageResult.data as any)?.bookTranslation;
        if (!bt) break;

        // deno-lint-ignore no-explicit-any
        for (const edge of bt.pericopeTranslations.edges) {
          pericopes.push(mapPericope(edge.node));
        }
        pageInfo = bt.pericopeTranslations.pageInfo;
      }

      // Sort pericopes by sequence
      pericopes.sort((a, b) => a.sequence - b.sequence);

      books.push({ id: bookId, title: bookTitle, pericopes });
    }

    const responseBody: FiaPericopesResponse = { books };

    return new Response(JSON.stringify(responseBody), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in fia-pericopes function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
