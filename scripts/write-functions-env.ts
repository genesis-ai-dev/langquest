import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const dotenvxCli = path.join(
  process.cwd(),
  'node_modules',
  '@dotenvx',
  'dotenvx',
  'src',
  'cli',
  'dotenvx.js'
);

const stdout = execFileSync(
  process.execPath,
  [
    dotenvxCli,
    'get',
    '-f',
    'supabase/.env',
    '-f',
    'supabase/.env.preview',
    '-f',
    'supabase/.env.local',
    '--overload'
  ],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  }
);

const parsed: unknown = JSON.parse(stdout);
if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
  throw new Error('dotenvx get did not return a JSON object');
}

const lines = Object.entries(parsed).map(([key, value]) => {
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
  return `${key}="${escaped}"`;
});

const outPath = path.join(process.cwd(), 'supabase', 'functions', '.env');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} keys to supabase/functions/.env`);
