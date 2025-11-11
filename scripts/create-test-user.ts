import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_USER = {
  email: 'aitest@langquest.local',
  password: 'Test123456!',
  username: 'AITestUser'
};

const ENGLISH_LANGUAGE_ID = 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd';
const SPANISH_LANGUAGE_ID = '7c37870b-7d52-4589-934f-576f03781263';

async function createTestUser() {
  console.log('🔧 Creating test user...');

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    user_metadata: {
      username: TEST_USER.username,
      ui_language_id: ENGLISH_LANGUAGE_ID,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString()
    }
  });

  if (authError) {
    if (
      authError.message.includes('already registered') ||
      authError.code === 'email_exists'
    ) {
      console.log('⚠️  User already exists, fetching existing user...');
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find((u) => u.email === TEST_USER.email);
      if (!existingUser) {
        throw new Error('User exists but could not be found');
      }
      console.log('✅ Using existing user:', existingUser.id);
      return existingUser.id;
    }
    throw authError;
  }

  if (!authUser.user) {
    throw new Error('Failed to create user');
  }

  console.log('✅ User created:', authUser.user.id);
  return authUser.user.id;
}

async function createProfile(userId: string) {
  console.log('🔧 Creating profile...');

  const sql = `
    INSERT INTO public.profile (id, username, ui_language_id, active, terms_accepted, terms_accepted_at, created_at, last_updated)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      ui_language_id = EXCLUDED.ui_language_id,
      active = EXCLUDED.active,
      last_updated = NOW();
  `;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      sql: sql,
      params: [
        userId,
        TEST_USER.username,
        ENGLISH_LANGUAGE_ID,
        true,
        true,
        new Date().toISOString()
      ]
    })
  });

  if (!response.ok) {
    console.log('⚠️  SQL RPC failed, trying direct SQL via postgrest...');
    const directSql = `
      INSERT INTO public.profile (id, username, ui_language_id, active, terms_accepted, terms_accepted_at, created_at, last_updated)
      VALUES ('${userId}', '${TEST_USER.username}', '${ENGLISH_LANGUAGE_ID}', true, true, '${new Date().toISOString()}', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        ui_language_id = EXCLUDED.ui_language_id,
        active = EXCLUDED.active,
        last_updated = NOW();
    `;
    const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: directSql })
    });

    if (!sqlResponse.ok) {
      console.log('⚠️  Trying to check if profile already exists and update via Supabase client...');
      const { data, error } = await supabase
        .from('profile')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (data) {
        console.log('✅ Profile already exists, skipping creation');
        return;
      }
      
      if (error && error.code !== 'PGRST116') {
        console.log('⚠️  Schema cache issue detected. Profile may be created by trigger.');
        console.log('⚠️  Continuing with project creation...');
        return;
      }
    }
  }

  console.log('✅ Profile created/updated');
}

async function createProject(userId: string) {
  console.log('🔧 Creating project...');

  const projectId = randomUUID();
  const project = {
    id: projectId,
    name: 'AI Translation Test Project',
    description: 'Project for testing AI translation functionality',
    target_language_id: SPANISH_LANGUAGE_ID,
    creator_id: userId,
    active: true
  };

  const { error: projectError } = await supabase.from('project').upsert(project);
  if (projectError) throw projectError;

  const { error: linkError } = await supabase.from('profile_project_link').upsert({
    profile_id: userId,
    project_id: projectId,
    membership: 'owner',
    active: true
  }, {
    onConflict: 'profile_id,project_id'
  });
  if (linkError) throw linkError;

  const { error: langLinkError } = await supabase.from('project_language_link').upsert({
    project_id: projectId,
    language_id: ENGLISH_LANGUAGE_ID,
    language_type: 'source',
    active: true
  });
  if (langLinkError) throw langLinkError;

  console.log('✅ Project created:', projectId);
  return projectId;
}

async function createQuests(projectId: string, userId: string) {
  console.log('🔧 Creating quests...');

  const quests = [
    {
      id: randomUUID(),
      name: 'Quest 1: Basic Phrases',
      description: 'Translate basic greeting phrases',
      project_id: projectId,
      creator_id: userId,
      active: true,
      visible: true
    },
    {
      id: randomUUID(),
      name: 'Quest 2: Common Questions',
      description: 'Translate common questions',
      project_id: projectId,
      creator_id: userId,
      active: true,
      visible: true
    }
  ];

  for (const quest of quests) {
    const { error } = await supabase.from('quest').upsert(quest);
    if (error) throw error;
  }

  console.log('✅ Quests created:', quests.length);
  return quests;
}

async function createAssetsWithContent(
  quests: Array<{ id: string }>,
  projectId: string,
  userId: string
) {
  console.log('🔧 Creating assets with source texts...');

  const sourceTexts = [
    'Hello, how are you?',
    'Good morning, nice to meet you.',
    'What is your name?',
    'Where are you from?',
    'Thank you very much.',
    'You are welcome.',
    'How much does this cost?',
    'Can you help me, please?'
  ];

  const assets = [];
  const assetContentLinks = [];
  const questAssetLinks = [];

  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const textsForQuest = sourceTexts.slice(i * 3, (i + 1) * 3);

    for (let j = 0; j < textsForQuest.length; j++) {
      const assetId = randomUUID();
      const text = textsForQuest[j];

      const now = new Date().toISOString();
      assets.push({
        id: assetId,
        name: `Asset ${i + 1}-${j + 1}`,
        source_language_id: ENGLISH_LANGUAGE_ID,
        project_id: projectId,
        creator_id: userId,
        active: true,
        visible: true,
        images: [],
        created_at: now,
        last_updated: now
      });

      assetContentLinks.push({
        id: randomUUID(),
        asset_id: assetId,
        source_language_id: ENGLISH_LANGUAGE_ID,
        text: text,
        active: true,
        created_at: now,
        last_updated: now
      });

      questAssetLinks.push({
        quest_id: quest.id,
        asset_id: assetId,
        active: true,
        visible: true,
        created_at: now,
        last_updated: now
      });
    }
  }

  for (const asset of assets) {
    const { error } = await supabase.from('asset').upsert(asset);
    if (error) throw error;
  }

  for (const contentLink of assetContentLinks) {
    const { error } = await supabase.from('asset_content_link').upsert(contentLink);
    if (error) throw error;
  }

  for (const questLink of questAssetLinks) {
    const { error } = await supabase.from('quest_asset_link').upsert(questLink);
    if (error) throw error;
  }

  console.log('✅ Assets created:', assets.length);
  console.log('✅ Asset content links created:', assetContentLinks.length);
  console.log('✅ Quest asset links created:', questAssetLinks.length);
}

async function main() {
  try {
    console.log('🚀 Starting test user creation...\n');

    const userId = await createTestUser();
    await createProfile(userId);
    const projectId = await createProject(userId);
    const quests = await createQuests(projectId, userId);
    await createAssetsWithContent(quests, projectId, userId);

    console.log('\n✅ Test user setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email:', TEST_USER.email);
    console.log('   Password:', TEST_USER.password);
    console.log('   Username:', TEST_USER.username);
    console.log('\n📊 Created:');
    console.log('   - 1 Project');
    console.log('   - 2 Quests');
    console.log('   - 6 Assets with source texts');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

