import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// --- Types ---

interface FiaPericopeStepsRequest {
  pericopeId: string;
  fiaLanguageCode: string;
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
  tokenExpiresAt = now + 14 * 60 * 1000;
  return cachedToken!;
}

// --- GraphQL ---

const PERICOPE_STEPS_QUERY = `
  query GetPericopeSteps($id: ID!) {
    pericope(id: $id) {
      id
      verseRangeShort

      pericopeTranslations(first: 100) {
        edges {
          node {
            language { id }
            stepRenderings(first: 10) {
              edges {
                node {
                  step { uniqueIdentifier }
                  stepTranslation { title }
                  textAsJson
                  textPlain
                  audioUrlVbr4
                }
              }
            }
          }
        }
      }

      mediaItems(first: 100) {
        edges {
          node {
            id
            uniqueIdentifier
            mediaItemTranslations(first: 50) {
              edges {
                node {
                  title
                  description
                  language { id }
                }
              }
            }
            mediaAssets(first: 50) {
              edges {
                node {
                  id
                  assetType { id }
                  attachment {
                    ... on ImageAttachment {
                      url500
                    }
                    ... on VideoAttachment {
                      url720p
                    }
                  }
                  mediaAssetTranslations(first: 50) {
                    edges {
                      node {
                        title
                        description
                        language { id }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      terms(first: 100) {
        edges {
          node {
            id
            uniqueIdentifier
            termTranslations(first: 50) {
              edges {
                node {
                  translatedTerm
                  descriptionHint
                  textPlain
                  language { id }
                }
              }
            }
          }
        }
      }

      map(first: 50) {
        edges {
          node {
            id
            uniqueIdentifier
            mapTranslations(first: 50) {
              edges {
                node {
                  title
                  imageUrl1500
                  language { id }
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

// --- Response shaping helpers ---

const STEP_ORDER = [
  'hear-and-heart',
  'setting-the-stage',
  'defining-the-scenes',
  'embodying-the-text',
  'filling-the-gaps',
  'speaking-the-word'
];

// deno-lint-ignore no-explicit-any
function findTranslation(edges: any[], lang: string) {
  return edges.find((e: { node: { language: { id: string } } }) => e.node.language.id === lang)?.node;
}

// deno-lint-ignore no-explicit-any
function shapeSteps(stepEdges: any[]): any[] {
  return STEP_ORDER
    .map((stepId) => {
      // deno-lint-ignore no-explicit-any
      const edge = stepEdges.find((e: any) => e.node.step?.uniqueIdentifier === stepId);
      if (!edge) return null;
      const n = edge.node;

      let textJson = null;
      if (n.textAsJson) {
        try {
          textJson = JSON.parse(n.textAsJson);
        } catch {
          // fall back to null
        }
      }

      return {
        stepId,
        title: n.stepTranslation?.title || stepId,
        textJson,
        textPlain: n.textPlain || '',
        audioUrl: n.audioUrlVbr4 || null
      };
    })
    .filter(Boolean);
}

// deno-lint-ignore no-explicit-any
function shapeMediaItems(mediaEdges: any[], lang: string): any[] {
  // deno-lint-ignore no-explicit-any
  return mediaEdges.map((me: any) => {
    const node = me.node;
    const trans = findTranslation(node.mediaItemTranslations?.edges || [], lang);

    // deno-lint-ignore no-explicit-any
    const assets = (node.mediaAssets?.edges || [])
      // deno-lint-ignore no-explicit-any
      .filter((ae: any) => {
        const attachment = ae.node.attachment;
        // Exclude video assets
        return !attachment?.url720p;
      })
      // deno-lint-ignore no-explicit-any
      .map((ae: any) => {
        const a = ae.node;
        const aTrans = findTranslation(a.mediaAssetTranslations?.edges || [], lang);
        return {
          type: a.assetType?.id || 'unknown',
          imageUrl: a.attachment?.url500 || null,
          title: aTrans?.title || '',
          description: aTrans?.description || ''
        };
      });

    return {
      id: node.uniqueIdentifier || node.id,
      title: trans?.title || '',
      description: trans?.description || '',
      assets
    };
  }).filter((m: { assets: unknown[] }) => m.assets.length > 0);
}

// deno-lint-ignore no-explicit-any
function shapeTerms(termEdges: any[], lang: string): any[] {
  // deno-lint-ignore no-explicit-any
  return termEdges.map((te: any) => {
    const node = te.node;
    const trans = findTranslation(node.termTranslations?.edges || [], lang);
    if (!trans) return null;
    return {
      id: node.uniqueIdentifier || node.id,
      term: trans.translatedTerm || '',
      hint: trans.descriptionHint || '',
      definition: trans.textPlain || null
    };
  }).filter(Boolean);
}

// deno-lint-ignore no-explicit-any
function shapeMaps(mapEdges: any[], lang: string): any[] {
  // deno-lint-ignore no-explicit-any
  return mapEdges.map((me: any) => {
    const node = me.node;
    const trans = findTranslation(node.mapTranslations?.edges || [], lang);
    if (!trans?.imageUrl1500) return null;
    return {
      id: node.uniqueIdentifier || node.id,
      title: trans.title || '',
      imageUrl: trans.imageUrl1500
    };
  }).filter(Boolean);
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

    const body: FiaPericopeStepsRequest = await req.json();
    if (!body.pericopeId || !body.fiaLanguageCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pericopeId, fiaLanguageCode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = await getFiaToken(accessKey);
    const result = await fiaGraphQL(token, PERICOPE_STEPS_QUERY, { id: body.pericopeId });

    if (result.errors?.length) {
      console.error('FIA GraphQL errors:', result.errors);
      return new Response(
        JSON.stringify({ error: 'FIA API returned errors', details: result.errors.map((e) => e.message) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const pericope = (result.data as any)?.pericope;
    if (!pericope) {
      return new Response(
        JSON.stringify({ error: `Pericope '${body.pericopeId}' not found` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const lang = body.fiaLanguageCode;

    // deno-lint-ignore no-explicit-any
    const translationEdge = pericope.pericopeTranslations?.edges?.find(
      (e: any) => e.node.language.id === lang
    );

    if (!translationEdge) {
      return new Response(
        JSON.stringify({ error: `No translation for language '${lang}' in pericope '${body.pericopeId}'` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stepEdges = translationEdge.node.stepRenderings?.edges || [];
    const mediaEdges = pericope.mediaItems?.edges || [];
    const termEdges = pericope.terms?.edges || [];
    const mapEdges = pericope.map?.edges || [];

    const responseBody = {
      steps: shapeSteps(stepEdges),
      mediaItems: shapeMediaItems(mediaEdges, lang),
      terms: shapeTerms(termEdges, lang),
      maps: shapeMaps(mapEdges, lang)
    };

    return new Response(JSON.stringify(responseBody), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in fia-pericope-steps function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
