// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { processSql, renderHttp } from 'npm:@supabase/sql-to-rest';

Deno.serve(async (req) => {
  let requestBody;

  try {
    requestBody = await req.json();
  } catch (error) {
    return new Response('Invalid JSON in request body', { status: 400 });
  }

  const { sql } = requestBody;

  if (!sql) {
    return new Response('No `sql` provided', { status: 400 });
  }

  console.log('sql', sql);

  let url: string;
  try {
    const statement = await processSql(sql);
    const httpRequest = await renderHttp(statement);

    url =
      `${Deno.env.get('SUPABASE_URL')}/rest/v1${httpRequest.fullPath}&apikey=${Deno.env.get('SUPABASE_ANON_KEY')}`.replace(
        '\n',
        ''
      );
  } catch (error: unknown) {
    console.error(error);
    return new Response(`Unsupported SQL: ${error}`, { status: 400 });
  }

  if (!url) {
    return new Response('No URL generated', { status: 400 });
  }

  const response = await fetch(url);

  const text = await response.text();
  if (!response.ok)
    throw new Error(
      JSON.stringify({
        url,
        status: response.status,
        statusText: response.statusText,
        text
      })
    );

  return new Response(text, {
    headers: { 'Content-Type': 'application/json' },
    status: response.status,
    statusText: response.statusText
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/sqltr' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
