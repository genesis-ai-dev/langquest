import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { randomUUID } from 'expo-crypto';
import { asset_content_link, translation } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Translation = typeof translation.$inferSelect;

export class TranslationService {
  async getTranslationsByAssetId(asset_id: string) {
    return await db.query.translation.findMany({
      where: eq(translation.asset_id, asset_id)
    });
  }

  async createTranslation(data: {
    text: string;
    target_language_id: string;
    asset_id: string;
    creator_id: string;
    audio: string;
  }) {
    const [newTranslation] = await db
      .insert(translation)
      .values({
        text: data.text,
        audio: data.audio,
        asset_id: data.asset_id,
        target_language_id: data.target_language_id,
        creator_id: data.creator_id
      })
      .returning();

    return newTranslation;
  }

  async updateTranslationAudio(translationId: string, attachmentId: string) {
    const [updatedTranslation] = await db
      .update(asset_content_link)
      .set({ audio_id: attachmentId })
      .where(eq(asset_content_link.id, translationId))
      .returning();

    return updatedTranslation;
  }
}

export const translationService = new TranslationService();
