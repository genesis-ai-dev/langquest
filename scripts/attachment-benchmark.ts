/**
 * Records a timing report for an attachment sync test run — works for BOTH
 * the old attachment-queue system and the new audio sync workers, because it
 * measures from the outside:
 *
 *   - uploads:   count of asset_content_link rows with audio_uploaded_at set
 *                (the storage trigger stamps these for either system)
 *   - downloads: count of audio files in the app's shared_attachments dir
 *                (via adb run-as)
 *   - stages:    app lifecycle markers scraped from adb logcat
 *                (login, workers/queues ready, first upload/download, ...)
 *
 * Start it BEFORE the phase you want to measure, leave it running, then
 * Ctrl+C when the phase is done — it prints a summary table and writes a
 * markdown report + CSV of samples under benchmark-reports/.
 *
 * Usage:
 *   npx tsx scripts/attachment-benchmark.ts --label old-upload
 *   npx tsx scripts/attachment-benchmark.ts --label new-upload
 *   npx tsx scripts/attachment-benchmark.ts --label new-download
 */

import { createClient } from '@supabase/supabase-js';
import { spawn, execFile } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const PACKAGE = 'com.etengenesis.langquest.preview';
const SAMPLE_MS = 2000;

/** Logcat lines that mark stage boundaries (matched against ReactNativeJS output). */
const MARKERS: { pattern: RegExp; label: string; once: boolean }[] = [
  { pattern: /Auth state changed: SIGNED_IN/, label: 'signed in', once: true },
  { pattern: /Attachment queues initialized/, label: 'queues ready (old system)', once: true },
  { pattern: /Audio sync workers started/, label: 'workers ready (new system)', once: true },
  { pattern: /\[AudioUploader\] Uploading \d+/, label: 'first upload pass (new)', once: true },
  { pattern: /\[AudioDownloader\] Downloading \d+/, label: 'first download pass (new)', once: true },
  { pattern: /\[WATCH IDS\]|watchAttachmentIds/, label: 'first reconcile (old)', once: true },
  { pattern: /Migration.*needed|Running migration/, label: 'migration', once: true }
];

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return (index >= 0 ? process.argv[index + 1] : undefined) ?? fallback;
}

const LABEL = arg('label', 'run');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface Sample {
  time: number;
  deviceFiles: number;
  confirmedUploads: number;
}

const startedAt = Date.now();
const samples: Sample[] = [];
const events: { time: number; label: string }[] = [];
const seenMarkers = new Set<string>();

function elapsed(time: number): string {
  const seconds = Math.round((time - startedAt) / 1000);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
}

async function countDeviceFiles(): Promise<number> {
  return new Promise((resolve) => {
    // The remote command must be a single arg so quoting survives adb shell.
    execFile(
      'adb',
      ['shell',
        `run-as ${PACKAGE} sh -c 'ls files/shared_attachments files/shared_attachments/local 2>/dev/null; true'`],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return resolve(-1);
        const count = stdout
          .split('\n')
          .filter((line) => /\.(wav|m4a|mp3|aac|ogg)$/.test(line.trim())).length;
        resolve(count);
      }
    );
  });
}

async function countConfirmedUploads(): Promise<number> {
  const { count, error } = await supabase
    .from('asset_content_link')
    .select('id', { count: 'exact', head: true })
    .not('audio_uploaded_at', 'is', null);
  return error ? -1 : (count ?? 0);
}

function watchLogcat(): void {
  // -T 1: only new lines from now on. ReactNativeJS carries console.* output.
  const logcat = spawn('adb', ['logcat', '-T', '1', '-s', 'ReactNativeJS:V']);
  let buffer = '';
  logcat.stdout.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      for (const marker of MARKERS) {
        if (marker.once && seenMarkers.has(marker.label)) continue;
        if (marker.pattern.test(line)) {
          seenMarkers.add(marker.label);
          events.push({ time: Date.now(), label: marker.label });
          console.log(`   📍 ${elapsed(Date.now())}  ${marker.label}`);
        }
      }
    }
  });
  logcat.on('error', () => {
    console.warn('⚠️  logcat unavailable — stage markers will be missing');
  });
}

/** A transfer "phase" = counter first changes → counter stops changing. */
function detectPhase(
  values: { time: number; value: number }[],
  name: string
): string[] {
  const changes = values.filter(
    (v, i) => i > 0 && v.value !== values[i - 1]!.value && v.value >= 0
  );
  if (changes.length === 0) return [`- ${name}: no activity observed`];
  const first = changes[0]!;
  const last = changes[changes.length - 1]!;
  const initial = values[0]!.value;
  const moved = last.value - initial;
  const durationS = Math.max(1, Math.round((last.time - first.time) / 1000));
  const rate = ((moved / durationS) * 60).toFixed(1);
  return [
    `- ${name}: ${initial} → ${last.value} (${moved >= 0 ? '+' : ''}${moved})`,
    `  - started ${elapsed(first.time)}, last change ${elapsed(last.time)}, duration ${Math.floor(durationS / 60)}m${String(durationS % 60).padStart(2, '0')}s`,
    `  - rate: ${rate} files/min`
  ];
}

function writeReport(): void {
  const lines: string[] = [
    `# Attachment benchmark: ${LABEL}`,
    ``,
    `Run started ${new Date(startedAt).toLocaleString()}, duration ${elapsed(Date.now())}.`,
    ``,
    `## Stage markers (from app logs)`,
    ``,
    ...(events.length > 0
      ? events.map((e) => `- ${elapsed(e.time)} — ${e.label}`)
      : ['- none captured']),
    ``,
    `## Transfers`,
    ``,
    ...detectPhase(
      samples.map((s) => ({ time: s.time, value: s.confirmedUploads })),
      'Uploads (server-confirmed)'
    ),
    ...detectPhase(
      samples.map((s) => ({ time: s.time, value: s.deviceFiles })),
      'Device files (downloads / promotions)'
    ),
    ``
  ];

  const report = lines.join('\n');
  console.log('\n' + report);

  mkdirSync('benchmark-reports', { recursive: true });
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = join('benchmark-reports', `${LABEL}-${stamp}`);
  writeFileSync(`${base}.md`, report);
  writeFileSync(
    `${base}.csv`,
    'elapsed_s,device_files,confirmed_uploads\n' +
      samples
        .map(
          (s) =>
            `${Math.round((s.time - startedAt) / 1000)},${s.deviceFiles},${s.confirmedUploads}`
        )
        .join('\n') +
      '\n'
  );
  console.log(`📝 Saved ${base}.md and .csv`);
}

async function main() {
  console.log(`🚀 Benchmark "${LABEL}" recording — Ctrl+C to stop and report\n`);
  watchLogcat();

  process.on('SIGINT', () => {
    writeReport();
    process.exit(0);
  });

  let lastPrinted = '';
  for (;;) {
    const [deviceFiles, confirmedUploads] = await Promise.all([
      countDeviceFiles(),
      countConfirmedUploads()
    ]);
    samples.push({ time: Date.now(), deviceFiles, confirmedUploads });
    const line = `files on device: ${deviceFiles} | confirmed uploads: ${confirmedUploads}`;
    if (line !== lastPrinted) {
      console.log(`   ${elapsed(Date.now())}  ${line}`);
      lastPrinted = line;
    }
    await new Promise((r) => setTimeout(r, SAMPLE_MS));
  }
}

void main();
