// Minimal queue worker for local Supabase. Processes at most one queued job per request.
import pg from 'npm:pg@8.11.3';

// Prefer internal DSN if available (works inside Docker network)
// Fallbacks:
// - 'db' is the standard hostname for the local Postgres service inside Supabase's Docker network
// - localhost:54322 works for direct host access when running via `supabase functions serve`
const dbUrl =
  Deno.env.get('SUPABASE_DB_URL') ||
  Deno.env.get('PS_DATA_SOURCE_URI') ||
  'postgresql://postgres:postgres@db:5432/postgres';
const { Pool } = pg as unknown as {
  Pool: new (opts: { connectionString: string; max?: number }) => any;
};
const pool = new Pool({ connectionString: dbUrl, max: 1 });

async function withClient<T>(fn: (c: any) => Promise<T>) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

type StepResult = { done: boolean; message: string };

async function processOneMessage(batchSize = 25, maxSteps = 6) {
  return withClient(async (c) => {
    // Read one message from pgmq
    const read = await c.query(
      'select * from pgmq.read($1::text, $2::int, $3::int)',
      ['clone_queue', 5, 1]
    );
    if (read.rowCount === 0) {
      return { status: 'empty', steps: [] as string[] };
    }

    const { msg_id, message } = read.rows[0] as {
      msg_id: number;
      message: { job_id?: string };
    };
    const jobId = message?.job_id;
    const steps: string[] = [];

    if (!jobId) {
      // bad message; archive and bail
      await c.query('select pgmq.archive($1::text, $2::bigint)', [
        'clone_queue',
        msg_id
      ]);
      return { status: 'archived_bad_message', steps };
    }

    // Perform several small steps; function is idempotent/staged
    for (let i = 0; i < maxSteps; i++) {
      const res = await c.query<StepResult>(
        'select * from public.perform_clone_step($1::uuid, $2::int)',
        [jobId, batchSize]
      );
      const row = res.rows[0];
      steps.push(row?.message ?? 'noop');
      if (row?.done) {
        // Finalize and archive the message
        await c.query('select pgmq.archive($1::text, $2::bigint)', [
          'clone_queue',
          msg_id
        ]);
        return { status: 'done', steps };
      }
    }

    // Not done; archive this message and send a new one immediately
    await c.query('select pgmq.archive($1::text, $2::bigint)', [
      'clone_queue', 
      msg_id
    ]);
    await c.query('select pgmq.send($1::text, $2::jsonb)', [
      'clone_queue',
      JSON.stringify({ job_id: jobId })
    ]);
    return { status: 'in_progress', steps };
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const batchSize = Number(url.searchParams.get('batchSize') ?? '25');
  const maxSteps = Number(url.searchParams.get('maxSteps') ?? '6');

  try {
    const result = await processOneMessage(
      Number.isFinite(batchSize) ? batchSize : 25,
      Number.isFinite(maxSteps) ? maxSteps : 6
    );
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ status: 'error', error: String(e?.message ?? e) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
});
