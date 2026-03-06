import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// --- Types ---

interface FiaPericopeTextRequest {
  pericopeId: string; // e.g. "mrk-p1"
  fiaLanguageCode: string; // e.g. "eng", "tpi"
}

interface FiaPericopeTextResponse {
  text: string; // Step 1 plain text
  stepTitle: string; // Translated step title (e.g. "Hear and Heart")
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

// Fetch pericope with step renderings for a specific language.
// We request all pericopeTranslations and filter by language on our side,
// since the FIA API cascades language context from the root query only when
// querying via the language node (not via the pericope node).
const PERICOPE_TEXT_QUERY = `
  query GetPericopeText($id: ID!) {
    pericope(id: $id) {
      id
      verseRangeShort

      pericopeTranslations(first: 100) {
        edges {
          node {
            language {
              id
            }
            stepRenderings(first: 10) {
              edges {
                node {
                  step {
                    uniqueIdentifier
                  }
                  stepTranslation {
                    title
                  }
                  textPlain
                }
              }
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

    const body: FiaPericopeTextRequest = await req.json();
    if (!body.pericopeId || !body.fiaLanguageCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: pericopeId, fiaLanguageCode'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get FIA bearer token
    const token = await getFiaToken(accessKey);

    // Fetch pericope with step renderings
    const result = await fiaGraphQL(token, PERICOPE_TEXT_QUERY, {
      id: body.pericopeId
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
    const pericope = (result.data as any)?.pericope;
    if (!pericope) {
      return new Response(
        JSON.stringify({
          error: `Pericope '${body.pericopeId}' not found`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find the translation matching the requested language
    // deno-lint-ignore no-explicit-any
    const translationEdge = pericope.pericopeTranslations?.edges?.find(
      (e: any) => e.node.language.id === body.fiaLanguageCode
    );

    if (!translationEdge) {
      return new Response(
        JSON.stringify({
          error: `No translation found for language '${body.fiaLanguageCode}' in pericope '${body.pericopeId}'`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find step 1 (hear-and-heart) rendering
    const stepRenderings = translationEdge.node.stepRenderings?.edges || [];
    // deno-lint-ignore no-explicit-any
    const step1 = stepRenderings.find(
      (e: any) => e.node.step?.uniqueIdentifier === 'hear-and-heart'
    );

    if (!step1) {
      return new Response(
        JSON.stringify({
          error: `Step 1 (hear-and-heart) not found for pericope '${body.pericopeId}' in language '${body.fiaLanguageCode}'`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const responseBody: FiaPericopeTextResponse = {
      text: step1.node.textPlain || '',
      stepTitle: step1.node.stepTranslation?.title || 'Hear and Heart'
    };

    return new Response(JSON.stringify(responseBody), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in fia-pericope-text function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
