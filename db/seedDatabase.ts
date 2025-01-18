import { db } from './database';
import {
  user,
  language,
  project,
  quest,
  tag,
  questToTags,
  asset,
  assetToTags,
  questToAssets,
  vote,
  translation,
} from './drizzleSchema';
import seedData from './seedData.json';
import { hashPassword } from '../utils/passwordUtils';
import { ASSET_MAP, getAssetId } from '../utils/assetUtils';

// Helper function to insert or update data
async function upsertData<T extends { id: string }>(table: any, data: T) {
  await db.insert(table).values(data).onConflictDoUpdate({
    target: table.id,
    set: data,
  });
}

// Helper function to insert relations
async function insertRelation(table: any, data: any) {
  await db.insert(table).values(data).onConflictDoNothing();
}

// Helper function to process user data
async function processUserData(userData: any) {
  return {
    ...userData,
    password: await hashPassword(userData.password),
  };
}

// Helper function to process asset data
function processAssetData(assetData: any) {
  return {
    ...assetData,
    text: Array.isArray(assetData.text)
      ? assetData.text.join('\n')
      : assetData.text,
    images:
      assetData.images?.map((img: string) => {
        // Ensure the image key exists in ASSET_MAP
        const key = img as keyof typeof ASSET_MAP;
        if (!(key in ASSET_MAP)) {
          throw new Error(`Image asset not found in ASSET_MAP: ${img}`);
        }
        return getAssetId(key);
      }) ?? [],
    audio:
      assetData.audio?.map((audio: string) => {
        // Ensure the audio key exists in ASSET_MAP
        const key = audio as keyof typeof ASSET_MAP;
        if (!(key in ASSET_MAP)) {
          throw new Error(`Audio asset not found in ASSET_MAP: ${audio}`);
        }
        return getAssetId(key);
      }) ?? [],
  };
}

export async function seedDatabase(
  clearExisting: boolean = false,
): Promise<boolean> {
  try {
    if (clearExisting) {
      // Clear all tables in reverse order of dependencies
      console.log('Clearing existing data...');
      await db.delete(vote);
      await db.delete(translation);
      await db.delete(questToAssets);
      await db.delete(assetToTags);
      await db.delete(questToTags);
      await db.delete(asset);
      await db.delete(quest);
      await db.delete(tag);
      await db.delete(project);
      await db.delete(user);
      await db.delete(language);
    }
    // Seed tables in order of dependencies
    for (const langData of seedData.languages) {
      await upsertData(language, langData);
    }

    for (const userData of seedData.users) {
      const processedUserData = await processUserData(userData);
      await upsertData(user, processedUserData);
    }

    for (const projectData of seedData.projects) {
      await upsertData(project, projectData);
    }

    for (const tagData of seedData.tags) {
      await upsertData(tag, tagData);
    }

    for (const questData of seedData.quests) {
      await upsertData(quest, questData);
    }

    for (const assetData of seedData.assets) {
      await upsertData(asset, processAssetData(assetData));
    }

    // Seed relations
    for (const relation of seedData.questToTags) {
      await insertRelation(questToTags, relation);
    }

    for (const relation of seedData.assetToTags) {
      await insertRelation(assetToTags, relation);
    }

    for (const relation of seedData.questToAssets) {
      await insertRelation(questToAssets, relation);
    }

    for (const translationData of seedData.translations) {
      await upsertData(translation, translationData);
    }

    for (const voteData of seedData.votes) {
      await upsertData(vote, voteData);
    }

    console.log('Database seeded successfully');
    return true;
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}
