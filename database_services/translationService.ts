import { and, eq, inArray, not } from 'drizzle-orm';
// import { db } from '../db/database';
import {
  asset_content_link,
  blocked_content
} from '@/db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Translation = typeof asset_content_link.$inferSelect;

export class TranslationService {
  async getTranslationsByAssetId(asset_id: string, current_user_id?: string) {
    // If no user is logged in, just return all translations
    if (!current_user_id) {
      return await db.query.asset_content_link.findMany({
        where: eq(asset_content_link.asset_id, asset_id)
      });
    }

    // Get blocked content for the current user
    const blockedContent = await db.query.blocked_content.findMany({
      where: and(
        eq(blocked_content.profile_id, current_user_id),
        eq(blocked_content.content_table, 'asset_content_link')
      ),
      columns: { content_id: true }
    });

    // Extract IDs
    const blockedContentIds = blockedContent.map((item) => item.content_id);

    // Query translations excluding blocked content
    const fetchedTranslations = await db.query.asset_content_link.findMany({
      where: and(
        eq(asset_content_link.asset_id, asset_id),
        blockedContentIds.length > 0
          ? not(inArray(asset_content_link.id, blockedContentIds))
          : undefined
      )
    });

    return fetchedTranslations;
  }

  async getTranslationById(translation_id: string, current_user_id?: string) {
    // If no user logged in, return the translation directly
    if (!current_user_id) {
      return await db.query.asset_content_link.findFirst({
        where: eq(asset_content_link.id, translation_id)
      });
    }

    // Check if this translation is blocked
    const isContentBlocked = await db.query.blocked_content.findFirst({
      where: and(
        eq(blocked_content.profile_id, current_user_id),
        eq(blocked_content.content_id, translation_id),
        eq(blocked_content.content_table, 'asset_content_link')
      )
    });

    if (isContentBlocked) {
      return null; // Translation is blocked
    }

    // Get the translation
    const translationData = await db.query.asset_content_link.findFirst({
      where: eq(asset_content_link.id, translation_id)
    });

    return translationData;
  }

  async createTranslation(data: {
    text: string | null;
    source_language_id: string;
    asset_id: string;
    audio: string[] | null;
  }) {
    const [newTranslation] = await db
      .insert(asset_content_link)
      .values({
        text: data.text,
        audio: data.audio,
        asset_id: data.asset_id,
        source_language_id: data.source_language_id,
        download_profiles: null
      })
      .returning();

    return newTranslation;
  }
}

export const translationService = new TranslationService();
