/**
 * Seeds the "stranded uploads" state for attachment load testing:
 * published records on the server that reference audio files which were
 * never uploaded to storage (audio_uploaded_at stays NULL, no storage
 * objects). Pair with scripts/seed-device-files.sh, which plants the
 * matching files on the device so they enter the upload queue.
 *
 * LOCAL DEV ONLY — hardcoded to the local Supabase stack, like
 * scripts/create-test-user.ts.
 *
 * Usage:
 *   npx tsx scripts/seed-attachment-load.ts [--count 10000] \
 *     [--email aitest@langquest.local] [--manifest /tmp/langquest-seed-manifest.txt]
 *
 * Output: a manifest file with one audio filename per line, consumed by
 * seed-device-files.sh.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const ASSETS_PER_QUEST = 500;
const INSERT_BATCH_SIZE = 500;

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const COUNT = parseInt(arg('count', '10000'), 10);
const EMAIL = arg('email', 'aitest@langquest.local');
const MANIFEST_PATH = arg('manifest', '/tmp/langquest-seed-manifest.txt');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function findUserId(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(
      `No user with email ${email}. Run scripts/create-test-user.ts first, or pass --email for an existing local user.`
    );
  }
  return user.id;
}

/** Any language-level languoid works; the app stores languoid ids in the *_language_id columns. */
async function findLanguoidId(): Promise<string> {
  const { data, error } = await supabase
    .from('languoid')
    .select('id, name')
    .eq('level', 'language')
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('No languoid rows in local database');
  console.log(`✅ Languoid: ${row.name} (${row.id})`);
  return row.id as string;
}

async function insertBatched(
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Insert into ${table} failed: ${error.message}`);
    }
    process.stdout.write(
      `\r   ${table}: ${Math.min(i + INSERT_BATCH_SIZE, rows.length)}/${rows.length}`
    );
  }
  process.stdout.write('\n');
}

async function main() {
  console.log(
    `🚀 Seeding ${COUNT} assets with un-uploaded audio for ${EMAIL}...`
  );

  const userId = await findUserId(EMAIL);
  console.log(`✅ User: ${userId}`);
  const languoidId = await findLanguoidId();

  const downloadProfiles = [userId];
  const now = new Date().toISOString();
  const stamp = { created_at: now, last_updated: now };

  // Project the seeded content lives in.
  const projectId = randomUUID();
  const runLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
  {
    const { error } = await supabase.from('project').insert({
      id: projectId,
      name: `Load Test ${runLabel}`,
      description: `${COUNT} assets with pending audio uploads`,
      target_language_id: languoidId,
      creator_id: userId,
      active: true,
      visible: true,
      private: true,
      download_profiles: downloadProfiles,
      ...stamp
    });
    if (error) throw new Error(`project insert failed: ${error.message}`);
  }
  {
    const { error } = await supabase.from('profile_project_link').insert({
      profile_id: userId,
      project_id: projectId,
      membership: 'owner',
      active: true,
      download_profiles: downloadProfiles,
      ...stamp
    });
    if (error) {
      throw new Error(`profile_project_link insert failed: ${error.message}`);
    }
  }
  {
    const { error } = await supabase.from('project_language_link').insert({
      project_id: projectId,
      languoid_id: languoidId,
      language_type: 'target',
      active: true,
      download_profiles: downloadProfiles,
      ...stamp
    });
    if (error) {
      throw new Error(`project_language_link insert failed: ${error.message}`);
    }
  }
  console.log(`✅ Project: ${projectId}`);

  // Quests, assets, links, and content rows. audio_uploaded_at is left NULL
  // and no storage object is created — exactly the stranded-upload state.
  const questCount = Math.ceil(COUNT / ASSETS_PER_QUEST);
  const quests: Record<string, unknown>[] = [];
  const assets: Record<string, unknown>[] = [];
  const questAssetLinks: Record<string, unknown>[] = [];
  const assetContentLinks: Record<string, unknown>[] = [];
  const filenames: string[] = [];

  for (let q = 0; q < questCount; q++) {
    const questId = randomUUID();
    quests.push({
      id: questId,
      name: `Load Quest ${q + 1}`,
      description: `Seeded quest ${q + 1}/${questCount}`,
      project_id: projectId,
      creator_id: userId,
      active: true,
      visible: true,
      download_profiles: downloadProfiles,
      ...stamp
    });

    const assetsInQuest = Math.min(
      COUNT - q * ASSETS_PER_QUEST,
      ASSETS_PER_QUEST
    );
    for (let a = 0; a < assetsInQuest; a++) {
      const assetId = randomUUID();
      const filename = `${randomUUID()}.wav`;
      const name = String(q * ASSETS_PER_QUEST + a + 1).padStart(5, '0');
      filenames.push(filename);

      assets.push({
        id: assetId,
        name,
        source_language_id: languoidId,
        project_id: projectId,
        creator_id: userId,
        content_type: 'source',
        order_index: a,
        active: true,
        visible: true,
        download_profiles: downloadProfiles,
        ...stamp
      });
      questAssetLinks.push({
        quest_id: questId,
        asset_id: assetId,
        name,
        order_index: a,
        active: true,
        visible: true,
        download_profiles: downloadProfiles,
        ...stamp
      });
      assetContentLinks.push({
        id: randomUUID(),
        asset_id: assetId,
        source_language_id: languoidId,
        languoid_id: languoidId,
        text: name,
        audio: [filename],
        order_index: 0,
        active: true,
        download_profiles: downloadProfiles,
        ...stamp
      });
    }
  }

  await insertBatched('quest', quests);
  await insertBatched('asset', assets);
  await insertBatched('quest_asset_link', questAssetLinks);
  await insertBatched('asset_content_link', assetContentLinks);

  writeFileSync(MANIFEST_PATH, filenames.join('\n') + '\n');

  console.log(`\n✅ Seeded ${COUNT} assets across ${questCount} quests`);
  console.log(`✅ Manifest (${filenames.length} filenames): ${MANIFEST_PATH}`);
  console.log(
    `\nNext: plant the files on the device:\n   ./scripts/seed-device-files.sh ${MANIFEST_PATH}`
  );
}

main().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
