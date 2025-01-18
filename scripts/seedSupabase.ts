import { createClient } from '@supabase/supabase-js';
import { randomUUID as cryptoRandomUUID } from 'crypto';
import dotenv from 'dotenv';

type SupabaseError = {
  name?: string;
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

dotenv.config();

// Helper function to generate UUIDs (replacing expo-crypto's randomUUID)
const randomUUID = () => cryptoRandomUUID();

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function seedLanguages() {
  console.log('Seeding languages...');
  
  const languages = [
    {
      id: randomUUID(),
      rev: 1,
      native_name: 'English',
      english_name: 'English',
      iso639_3: 'eng',
      ui_ready: 1,
      version_chain_id: randomUUID(),
    },
    {
      id: randomUUID(),
      rev: 1,
      native_name: 'Español',
      english_name: 'Spanish',
      iso639_3: 'spa',
      ui_ready: 1,
      version_chain_id: randomUUID(),
    }
  ];

  // First, let's check if we can connect to Supabase
  const { data: testData, error: testError } = await supabase
    .from('Language')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('Connection test error:', testError);
    throw testError;
  }

  console.log('Connection successful, attempting to seed...');

  const { data, error } = await supabase
    .from('Language')
    .upsert(languages)
    .select();

  if (error) {
    console.error('Seeding error:', error);
    throw error;
  }

  console.log('Seeded data:', data);
  console.log('Languages seeded successfully');
  return languages;
}

// async function seedTags() {
//   console.log('Seeding tags...');
  
//   const tagData = [
//     { name: 'Book:Romans', version_chain_id: randomUUID() },
//     { name: 'Chapter:1', version_chain_id: randomUUID() },
//     { name: 'Chapter:2', version_chain_id: randomUUID() },
//     { name: 'Author:Paul', version_chain_id: randomUUID() },
//     { name: 'Difficulty:Easy', version_chain_id: randomUUID() },
//     { name: 'Difficulty:Medium', version_chain_id: randomUUID() },
//   ];

//   const tags = tagData.map(tag => ({
//     id: randomUUID(),
//     rev: 1,
//     ...tag
//   }));

//   const { error } = await supabase
//     .from('tag')
//     .upsert(tags);

//   if (error) throw error;
//   console.log('Tags seeded successfully');
//   return tags;
// }

// async function seedProjects() {
//   console.log('Seeding projects...');
  
//   // Get language IDs first
//   const { data: languages, error: langError } = await supabase
//     .from('language')
//     .select('id, english_name');
  
//   if (langError) throw langError;
  
//   const english = languages?.find(l => l.english_name === 'English');
//   const spanish = languages?.find(l => l.english_name === 'Spanish');

//   if (!english || !spanish) throw new Error('Languages not found');

//   const projects = [
//     {
//       id: randomUUID(),
//       rev: 1,
//       name: 'English Learning Basics',
//       description: 'Basic English learning materials for Spanish speakers',
//       source_language_id: spanish.id,
//       target_language_id: english.id,
//       version_chain_id: 'project-1-chain',
//     },
//     {
//       id: randomUUID(),
//       rev: 1,
//       name: 'Spanish for Beginners',
//       description: 'Learn Spanish from English',
//       source_language_id: english.id,
//       target_language_id: spanish.id,
//       version_chain_id: 'project-2-chain',
//     }
//   ];

//   const { error } = await supabase
//     .from('project')
//     .upsert(projects);

//   if (error) throw error;
//   console.log('Projects seeded successfully');
//   return projects;
// }

async function seedSupabase() {
  try {
    // Log environment variables (redacted)
    console.log('Supabase URL exists:', !!process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log('Supabase Anon Key exists:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    
    await seedLanguages();
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error: unknown) {
    // Type guard to check if error is an object
    const supabaseError = error as SupabaseError;
    
    console.error('Error seeding database:', {
      name: supabaseError?.name || 'Unknown error',
      message: supabaseError?.message || 'No error message available',
      details: supabaseError?.details || 'No details available',
      hint: supabaseError?.hint || 'No hint available',
      code: supabaseError?.code || 'No error code available'
    });
    process.exit(1);
  }
}

seedSupabase();