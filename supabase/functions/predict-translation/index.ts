import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface PredictionRequest {
  sourceText: string;
  examples: Array<{ source: string; target: string }>;
  sourceLanguageName: string;
  targetLanguageName: string;
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
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get API key from environment variable (set via Supabase Dashboard secrets in production)
    // For local development, set in langquest/supabase/.env file
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not set');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: PredictionRequest = await req.json();

    // Validate request
    if (!body.sourceText || !body.sourceLanguageName || !body.targetLanguageName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = body.model || DEFAULT_MODEL;

    // Build prompt with examples
    let prompt = `You are a professional translator. Translate the following text from ${body.sourceLanguageName} to ${body.targetLanguageName}.\n\n`;

    if (body.examples && body.examples.length > 0) {
      prompt += `Here are some example translations from the same context:\n\n`;
      body.examples.forEach((example, index) => {
        prompt += `Example ${index + 1}:\n`;
        prompt += `Source (${body.sourceLanguageName}): ${example.source}\n`;
        prompt += `Target (${body.targetLanguageName}): ${example.target}\n\n`;
      });
      prompt += `Now translate the following text using the same style and context:\n\n`;
    }

    prompt += `Source (${body.sourceLanguageName}): ${body.sourceText}\n`;
    prompt += `Target (${body.targetLanguageName}):\n\n`;
    prompt += `Please respond with ONLY the translation wrapped in XML tags like this:\n<final_translation>your translation here</final_translation>`;

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
        'X-Title': 'LangQuest Translation Prediction'
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Translation prediction failed', details: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content?.trim();

    if (!rawResponse) {
      return new Response(
        JSON.stringify({ error: 'No translation returned from API' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse XML to extract final_translation tag
    let predictedText = rawResponse;
    const xmlMatch = rawResponse.match(/<final_translation>(.*?)<\/final_translation>/s);
    if (xmlMatch && xmlMatch[1]) {
      predictedText = xmlMatch[1].trim();
    } else {
      // Fallback: if no XML tag found, use the raw response (for backwards compatibility)
      console.warn('No <final_translation> XML tag found in response, using raw text');
    }

    return new Response(
      JSON.stringify({ 
        translation: predictedText,
        rawResponse: rawResponse 
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error in predict-translation function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

