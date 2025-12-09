import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

Deno.serve(async (req) => {
  // CORS preflight
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
    const modalEndpoint = Deno.env.get('MODAL_ASR_ENDPOINT');
    if (!modalEndpoint) {
      console.error('MODAL_ASR_ENDPOINT not configured');
      return new Response(
        JSON.stringify({ error: 'ASR endpoint not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File too large (max 50MB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (file.size === 0) {
      return new Response(JSON.stringify({ error: 'Empty file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Forward to Modal ASR endpoint
    const proxyFormData = new FormData();
    proxyFormData.append('file', file);

    const response = await fetch(`${modalEndpoint}/transcribe`, {
      method: 'POST',
      body: proxyFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Modal ASR error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Transcription failed',
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

