import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { translation, vote, language, profile } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { system,  } from '../db/powersync/system';

const { db } = system;

export type Translation = typeof translation.$inferSelect

export class TranslationService {
  async getTranslationsByAssetId(asset_id: string): Promise<Translation[]> {
    return db
      .select()
      .from(translation)
      .where(eq(translation.asset_id, asset_id));
  }

  async createTranslation(data: {
    text: string;
    target_language_id: string;
    asset_id: string;
    creator_id: string;
    // audio?: string[];
  }) {
    const [newTranslation] = await db
      .insert(translation)
      .values({
        rev: 1,
        text: data.text,
        audio: [], // Empty array for now
        asset_id: data.asset_id,
        target_language_id: data.target_language_id,
        creator_id: data.creator_id,
        version_chain_id: randomUUID(),
      })
      .returning();
    
    return newTranslation;
  }

  async updateTranslationAudio(translationId: string, audioUri: string) {
    const [updatedTranslation] = await db
      .update(translation)
      .set({ audio: audioUri })
      .where(eq(translation.id, translationId))
      .returning();
    
    return updatedTranslation;
  }
}

export const translationService = new TranslationService();