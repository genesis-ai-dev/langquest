import { and, eq, inArray, not } from 'drizzle-orm';
// import { db } from '../db/database';
import {
  blocked_content,
  blocked_users,
  translation
} from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Translation = typeof translation.$inferSelect;

export class TranslationService {
  async getTranslationsByAssetId(asset_id: string, current_user_id?: string) {
    // If no user is logged in, just return all translations
    if (!current_user_id) {
      return await db.query.translation.findMany({
        where: eq(translation.asset_id, asset_id)
      });
    }

    // Get blocked users for the current user
    const blockedUsers = await db.query.blocked_users.findMany({
      where: eq(blocked_users.blocker_id, current_user_id),
      columns: { blocked_id: true }
    });

    // Get blocked content for the current user
    const blockedContent = await db.query.blocked_content.findMany({
      where: and(
        eq(blocked_content.profile_id, current_user_id),
        eq(blocked_content.content_table, 'translations')
      ),
      columns: { content_id: true }
    });

    // Extract IDs
    const blockedUserIds = blockedUsers.map((item) => item.blocked_id);
    const blockedContentIds = blockedContent.map((item) => item.content_id);

    // Query translations excluding blocked content
    const fetchedTranslations = await db.query.translation.findMany({
      where: and(
        eq(translation.asset_id, asset_id),
        blockedUserIds.length > 0
          ? not(inArray(translation.creator_id, blockedUserIds))
          : undefined,
        blockedContentIds.length > 0
          ? not(inArray(translation.id, blockedContentIds))
          : undefined
      )
    });

    return fetchedTranslations;
  }

  async getTranslationById(translation_id: string, current_user_id?: string) {
    // If no user logged in, return the translation directly
    if (!current_user_id) {
      return await db.query.translation.findFirst({
        where: eq(translation.id, translation_id)
      });
    }

    // Check if this translation is blocked
    const isContentBlocked = await db.query.blocked_content.findFirst({
      where: and(
        eq(blocked_content.profile_id, current_user_id),
        eq(blocked_content.content_id, translation_id),
        eq(blocked_content.content_table, 'translation')
      )
    });

    if (isContentBlocked) {
      return null; // Translation is blocked
    }

    // Get the translation
    const translationData = await db.query.translation.findFirst({
      where: eq(translation.id, translation_id)
    });

    if (!translationData) {
      return null;
    }

    // Check if created by a blocked user
    const isCreatorBlocked = await db.query.blocked_users.findFirst({
      where: and(
        eq(blocked_users.blocker_id, current_user_id),
        eq(blocked_users.blocked_id, translationData.creator_id)
      )
    });

    if (isCreatorBlocked) {
      return null; // Creator is blocked
    }

    return translationData;
  }

  async createTranslation(data: {
    text: string | null;
    target_language_id: string;
    asset_id: string;
    creator_id: string;
    audio: string | null;
  }) {
    const [newTranslation] = await db
      .insert(translation)
      .values({
        text: data.text,
        audio: data.audio,
        asset_id: data.asset_id,
        target_language_id: data.target_language_id,
        creator_id: data.creator_id,
        download_profiles: [data.creator_id]
      })
      .returning();

    return newTranslation;
  }
}

export const translationService = new TranslationService();
