/// <reference types="node" />
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = resolve(ROOT, '.env.local');

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

function requireVar(
  env: Record<string, string>,
  key: string,
  fallbackKeys: string[] = []
): string {
  const direct = process.env[key] || env[key];
  if (direct) return direct;
  for (const fallback of fallbackKeys) {
    const value = process.env[fallback] || env[fallback];
    if (value) return value;
  }
  throw new Error(
    `Missing ${key}. Run npm run generate-env and npm run env:start.`
  );
}

const ANDROID_STUDIO_JBR =
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

function ensureJavaHome(): void {
  if (process.env.JAVA_HOME) return;
  if (!existsSync(ANDROID_STUDIO_JBR)) return;
  process.env.JAVA_HOME = ANDROID_STUDIO_JBR;
  process.env.PATH = `${ANDROID_STUDIO_JBR}/bin:${process.env.PATH ?? ''}`;
}

function main() {
  ensureJavaHome();
  if (!existsSync(ENV_PATH)) {
    throw new Error(
      'No .env.local found. Run npm run generate-env, then npm run env:start.'
    );
  }

  const fileEnv = parseEnvFile(readFileSync(ENV_PATH, 'utf8'));
  // MAESTRO_APP_VARIANT lets Maestro target a preview/production build
  // installed alongside the dev client without changing the variant that
  // drives `expo run:android` and `expo start`.
  const variant =
    process.env.MAESTRO_APP_VARIANT ||
    fileEnv.MAESTRO_APP_VARIANT ||
    fileEnv.EXPO_PUBLIC_APP_VARIANT ||
    'development';
  if (!['development', 'preview', 'production'].includes(variant)) {
    throw new Error(
      `MAESTRO_APP_VARIANT must be development, preview, or production. Received: ${variant}`
    );
  }
  const appId =
    process.env.MAESTRO_APP_ID ||
    fileEnv.MAESTRO_APP_ID ||
    (variant === 'preview'
      ? 'com.etengenesis.langquest.preview'
      : variant === 'production'
        ? 'com.etengenesis.langquest'
        : 'com.etengenesis.langquest.development');

  const isDevClient = appId.endsWith('.development');
  const metroUrl =
    process.env.MAESTRO_METRO_URL ||
    fileEnv.MAESTRO_METRO_URL ||
    fileEnv.EXPO_PUBLIC_SITE_URL ||
    'http://localhost:8081';
  const maestroEnv: Record<string, string> = {
    MAESTRO_APP_ID: appId,
    MAESTRO_SUPABASE_URL: requireVar(fileEnv, 'MAESTRO_SUPABASE_URL', [
      'EXPO_PUBLIC_SUPABASE_URL'
    ]),
    MAESTRO_SUPABASE_SERVICE_ROLE_KEY: requireVar(
      fileEnv,
      'MAESTRO_SUPABASE_SERVICE_ROLE_KEY',
      ['SUPABASE_SERVICE_ROLE_KEY']
    ),
    MAESTRO_SITE_URL: requireVar(fileEnv, 'MAESTRO_SITE_URL', [
      'EXPO_PUBLIC_SITE_URL'
    ]),
    // Bucket the app uploads audio to; api.js seeds and inspects objects there.
    MAESTRO_SUPABASE_BUCKET:
      process.env.MAESTRO_SUPABASE_BUCKET ||
      fileEnv.MAESTRO_SUPABASE_BUCKET ||
      fileEnv.EXPO_PUBLIC_SUPABASE_BUCKET ||
      'local',
    MAESTRO_USE_DEV_CLIENT: isDevClient ? 'true' : 'false',
    MAESTRO_DEV_CLIENT_URL: isDevClient
      ? `exp+langquest://expo-development-client/?url=${encodeURIComponent(metroUrl)}`
      : '',
    MAESTRO_APP_SCHEME:
      variant === 'preview'
        ? 'langquest-preview'
        : variant === 'production'
          ? 'langquest'
          : 'langquest-dev'
  };

  const DEFAULT_LOCAL_FLOWS = [
    '.maestro/flows/local-suite.yaml',
    '.maestro/flows/register.yaml',
    '.maestro/flows/public-browse.yaml',
    '.maestro/flows/private-access-gate.yaml',
    '.maestro/flows/invite-accept.yaml',
    '.maestro/flows/invite-decline.yaml',
    '.maestro/flows/membership-moderation.yaml',
    '.maestro/flows/auth-guest.yaml',
    '.maestro/flows/session-account.yaml',
    '.maestro/flows/account-deletion.yaml',
    '.maestro/flows/search-and-tabs.yaml',
    '.maestro/flows/profile-chrome.yaml',
    '.maestro/flows/appearance.yaml',
    '.maestro/flows/settings-gated.yaml',
    '.maestro/flows/download-quest.yaml',
    '.maestro/flows/offload-shared-draft.yaml',
    '.maestro/flows/offline-create-quest.yaml',
    '.maestro/flows/offline-create-project.yaml',
    '.maestro/flows/offline-translate-vote-sync.yaml',
    '.maestro/flows/offline-downloaded-quest-contribute.yaml',
    '.maestro/flows/offline-relaunch-keep-state.yaml',
    '.maestro/flows/offline-download-offload-gates.yaml',
    '.maestro/flows/offline-membership-gates.yaml',
    '.maestro/flows/asset-manage.yaml',
    '.maestro/flows/asset-settings.yaml',
    '.maestro/flows/recording-screen.yaml',
    '.maestro/flows/asset-batch-ops.yaml',
    '.maestro/flows/asset-file-upload.yaml',
    '.maestro/flows/asset-file-upload-offline.yaml',
    '.maestro/flows/asset-file-download.yaml',
    '.maestro/flows/asset-file-delete-queue.yaml',
    '.maestro/flows/bible-navigation.yaml',
    '.maestro/flows/create-bible-project.yaml',
    '.maestro/flows/fia-gate.yaml',
    '.maestro/flows/report-project.yaml',
    '.maestro/flows/report-quest-asset.yaml'
  ];

  const flowArgs = process.argv.slice(2);
  const flows = flowArgs.length > 0 ? flowArgs : DEFAULT_LOCAL_FLOWS;

  function maestroArgs(flowFiles: string[]): string[] {
    const args = ['test'];
    const platform = process.env.MAESTRO_PLATFORM;
    const device = process.env.MAESTRO_DEVICE;
    if (platform) {
      args.push('--platform', platform);
    }
    if (device) {
      args.push('--device', device);
    }
    for (const [key, value] of Object.entries(maestroEnv)) {
      args.push('-e', `${key}=${value}`);
    }
    args.push(...flowFiles);
    return args;
  }

  function runMaestro(flowFiles: string[]): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn('maestro', maestroArgs(flowFiles), {
        stdio: 'inherit',
        env: process.env
      });
      child.on('exit', (code) => {
        resolve(code ?? 1);
      });
      child.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.error(
            'maestro is not on PATH. Install it: https://maestro.dev'
          );
        } else {
          console.error(error);
        }
        resolve(1);
      });
    });
  }

  console.log(`Maestro app: ${maestroEnv.MAESTRO_APP_ID} (${variant})`);
  console.log(`Maestro supabase: ${maestroEnv.MAESTRO_SUPABASE_URL}`);
  if (process.env.JAVA_HOME) {
    console.log(`Maestro JAVA_HOME: ${process.env.JAVA_HOME}`);
  }
  if (isDevClient) {
    console.log(`Maestro metro: ${metroUrl}`);
    console.log(
      'Dev client: Metro and the Dev Menu can flake launch. Prefer MAESTRO_APP_VARIANT=preview (npm run maestro:local:preview) for the full suite.'
    );
  }
  console.log(`Flows: ${flows.join(' ')}`);

  void (async () => {
    process.exit(await runMaestro(flows));
  })();
}

main();
