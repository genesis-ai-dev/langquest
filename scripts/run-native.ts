/// <reference types="node" />
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = resolve(ROOT, '.env.local');
const UNIQUE_IDENTIFIER = 'com.etengenesis.langquest';
const VARIANTS = ['development', 'preview', 'production'] as const;

type Platform = 'android' | 'ios';
type Variant = (typeof VARIANTS)[number];

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function resolveVariant(): Variant {
  const fileEnv = existsSync(ENV_PATH)
    ? parseEnvFile(readFileSync(ENV_PATH, 'utf8'))
    : {};
  // Same resolution as app.config.ts, plus .env.local (Expo loads that later).
  const raw =
    process.env.EXPO_PUBLIC_APP_VARIANT ||
    fileEnv.EXPO_PUBLIC_APP_VARIANT ||
    (process.env.NODE_ENV === 'development' ? 'development' : 'production');
  if (!VARIANTS.includes(raw as Variant)) {
    throw new Error(
      `EXPO_PUBLIC_APP_VARIANT must be development, preview, or production. Received: ${raw}`
    );
  }
  return raw as Variant;
}

// Keep in sync with getBundleIdentifier in app.config.ts.
function expectedApplicationId(variant: Variant): string {
  switch (variant) {
    case 'development':
      return `${UNIQUE_IDENTIFIER}.development`;
    case 'preview':
      return `${UNIQUE_IDENTIFIER}.preview`;
    default:
      return UNIQUE_IDENTIFIER;
  }
}

function isCompatibleId(found: string, expected: string): boolean {
  return found === expected || found === `${expected}.tests`;
}

function androidApplicationIds(): string[] {
  const gradle = resolve(ROOT, 'android/app/build.gradle');
  if (!existsSync(gradle)) return [];
  const text = readFileSync(gradle, 'utf8');
  return [...text.matchAll(/applicationId\s+['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? ''
  );
}

function iosBundleIds(): string[] {
  const iosDir = resolve(ROOT, 'ios');
  if (!existsSync(iosDir)) return [];
  const ids: string[] = [];
  for (const entry of readdirSync(iosDir)) {
    if (!entry.endsWith('.xcodeproj')) continue;
    const pbx = resolve(iosDir, entry, 'project.pbxproj');
    if (!existsSync(pbx)) continue;
    const text = readFileSync(pbx, 'utf8');
    for (const match of text.matchAll(
      /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g
    )) {
      const id = (match[1] ?? '').trim().replace(/"/g, '');
      if (!id || id.includes('$(')) continue;
      ids.push(id);
    }
  }
  return ids;
}

function nativeIds(platform: Platform): string[] {
  return platform === 'android' ? androidApplicationIds() : iosBundleIds();
}

function needsPrebuild(platform: Platform, expected: string): boolean {
  const platformDir = resolve(ROOT, platform);
  if (!existsSync(platformDir)) return true;
  const ids = nativeIds(platform).filter((id) =>
    id.startsWith(UNIQUE_IDENTIFIER)
  );
  if (ids.length === 0) return true;
  return ids.some((id) => !isCompatibleId(id, expected));
}

function run(
  command: string,
  args: string[],
  extraEnv: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: ROOT,
      env: { ...process.env, ...extraEnv }
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
    child.on('error', reject);
  });
}

async function main() {
  const [platform, ...expoRunArgs] = process.argv.slice(2);
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error(
      'Usage: npx tsx ./scripts/run-native.ts <android|ios> [...expo run args]'
    );
  }

  const variant = resolveVariant();
  const expected = expectedApplicationId(variant);
  process.env.EXPO_PUBLIC_APP_VARIANT = variant;

  if (needsPrebuild(platform, expected)) {
    const found = nativeIds(platform);
    console.log(
      `Native ${platform} identity is ${found.join(', ') || '(missing)'}; ${variant} needs ${expected}. Running expo prebuild --platform ${platform} --clean.`
    );
    const prebuildCode = await run(
      'expo',
      ['prebuild', '--platform', platform, '--clean'],
      { EXPO_NO_GIT_STATUS: '1' }
    );
    if (prebuildCode !== 0) process.exit(prebuildCode);
  }

  const runCode = await run('expo', [`run:${platform}`, ...expoRunArgs]);
  process.exit(runCode);
}

void main();
