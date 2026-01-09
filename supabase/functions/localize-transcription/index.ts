import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface LocalizationRequest {
  phoneticText: string;
  examples: string[];
  languageName: string;
  model?: string;
}

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

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
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not set');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: LocalizationRequest = await req.json();

    // Validate request
    if (!body.phoneticText || !body.languageName) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: phoneticText and languageName'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = body.model || DEFAULT_MODEL;

    // Build prompt for phonetic → orthographic conversion
    let prompt = `You are helping convert phonetic or approximated transcription into proper orthography for ${body.languageName}.\n\n`;

    if (body.examples && body.examples.length > 0) {
      prompt += `Here are examples of correctly written text in ${body.languageName}:\n\n`;
      body.examples.forEach((example, index) => {
        prompt += `Example ${index + 1}: ${example}\n`;
      });
      prompt += `\n`;
    }

    prompt += `The following is a phonetic rendering from speech recognition. It may contain approximated spellings, phonetic representations, or errors due to the speech recognition system not knowing this language's orthography.\n\n`;
    prompt += `Phonetic transcription: ${body.phoneticText}\n\n`;
    prompt += `Please rewrite this using the proper spelling and orthography of ${body.languageName}, as demonstrated in the examples above.\n\n`;
    prompt += `Respond with ONLY the localized text wrapped in XML tags like this:\n<localized_transcription>your localized text here</localized_transcription>`;

    // Call OpenRouter API
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
          'X-Title': 'LangQuest Transcription Localization'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Transcription localization failed',
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content?.trim();

    if (!rawResponse) {
      return new Response(
        JSON.stringify({ error: 'No localized text returned from API' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse XML to extract localized_transcription tag
    let localizedText = rawResponse;
    const xmlMatch = rawResponse.match(
      /<localized_transcription>(.*?)<\/localized_transcription>/s
    );
    if (xmlMatch && xmlMatch[1]) {
      localizedText = xmlMatch[1].trim();
    } else {
      console.warn(
        'No <localized_transcription> XML tag found in response, using raw text'
      );
    }

    return new Response(
      JSON.stringify({
        localizedText,
        rawResponse
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error in localize-transcription function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
