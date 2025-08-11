import { and, eq, inArray, not } from 'drizzle-orm';
// import { db } from '../db/database';
import { structuredProjectCreator } from '@/utils/structuredProjectCreator';
import {
  asset,
  blocked_content,
  blocked_users,
  translation,
  translation_audio_link
} from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Translation = typeof translation.$inferSelect;
export type TranslationAudioLink = typeof translation_audio_link.$inferSelect;

export class TranslationService {
  async getTranslationsByAssetId(asset_id: string, current_user_id?: string) {
    // If no user is logged in, just return all translations with audio segments
    if (!current_user_id) {
      return await db.query.translation.findMany({
        where: eq(translation.asset_id, asset_id),
        with: {
          audio_segments: {
            orderBy: (segments, { asc }) => [asc(segments.sequence_index)]
          }
        }
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
      ),
      with: {
        audio_segments: {
          orderBy: (segments, { asc }) => [asc(segments.sequence_index)]
        }
      }
    });

    return fetchedTranslations;
  }

  async getTranslationById(translation_id: string, current_user_id?: string) {
    // If no user logged in, return the translation with audio segments directly
    if (!current_user_id) {
      return await db.query.translation.findFirst({
        where: eq(translation.id, translation_id),
        with: {
          audio_segments: {
            orderBy: (segments, { asc }) => [asc(segments.sequence_index)]
          }
        }
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

    // Get the translation with audio segments
    const translationData = await db.query.translation.findFirst({
      where: eq(translation.id, translation_id),
      with: {
        audio_segments: {
          orderBy: (segments, { asc }) => [asc(segments.sequence_index)]
        }
      }
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
    audio_urls?: string[];
    materializeIfMissing?: {
      templateId: string;
      projectId: string;
      projectSourceLanguageId: string;
      questName: string;
      assetName: string;
    };
  }) {
    // Materialize quest/asset if the asset doesn't exist yet and we have template context
    let assetIdToUse = data.asset_id;
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, data.asset_id)
    });

    if ((!existingAsset || data.asset_id.startsWith('virtual_')) && data.materializeIfMissing) {
      const { templateId, projectId, projectSourceLanguageId, questName, assetName } =
        data.materializeIfMissing;

      const { assetId } = await structuredProjectCreator.materializeForTranslation({
        templateId,
        projectId,
        projectSourceLanguageId,
        questName,
        assetName,
        creatorId: data.creator_id
      });
      assetIdToUse = assetId;
    }
    // Create the translation record (no audio field)
    const [newTranslation] = await db
      .insert(translation)
      .values({
        text: data.text,
        asset_id: assetIdToUse,
        target_language_id: data.target_language_id,
        creator_id: data.creator_id,
        download_profiles: [data.creator_id]
      })
      .returning();

    if (!newTranslation) {
      throw new Error('Failed to create translation');
    }

    // Create audio segment records if provided
    if (data.audio_urls?.length) {
      const audioLinks = data.audio_urls.map((url, index) => ({
        translation_id: newTranslation.id,
        audio_url: url,
        sequence_index: index,
        download_profiles: [data.creator_id]
      }));

      await db.insert(translation_audio_link).values(audioLinks);
    }

    return newTranslation;
  }

  // New method for reordering (owner-only)
  async reorderAudioSegments(
    translation_id: string,
    new_order: string[], // Array of translation_audio_link IDs in new order
    user_id: string
  ) {
    // Check ownership
    const translation_record = await db.query.translation.findFirst({
      where: eq(translation.id, translation_id)
    });

    if (translation_record?.creator_id !== user_id) {
      throw new Error('Only the translation creator can reorder audio segments');
    }

    // Update sequence_index for each segment
    const updatePromises = new_order.map((segment_id, index) =>
      db.update(translation_audio_link)
        .set({ sequence_index: index })
        .where(eq(translation_audio_link.id, segment_id))
    );

    await Promise.all(updatePromises);
  }

  // Add a new audio segment to an existing translation
  async addAudioSegment(
    translation_id: string,
    audio_url: string,
    user_id: string
  ) {
    // Check ownership
    const translation_record = await db.query.translation.findFirst({
      where: eq(translation.id, translation_id)
    });

    if (translation_record?.creator_id !== user_id) {
      throw new Error('Only the translation creator can add audio segments');
    }

    // Get the current highest sequence index
    const existingSegments = await db.query.translation_audio_link.findMany({
      where: eq(translation_audio_link.translation_id, translation_id),
      orderBy: (segments, { desc }) => [desc(segments.sequence_index)]
    });

    const nextIndex = existingSegments.length > 0 && existingSegments[0]
      ? existingSegments[0].sequence_index + 1
      : 0;

    // Insert the new audio segment
    const [newSegment] = await db
      .insert(translation_audio_link)
      .values({
        translation_id,
        audio_url,
        sequence_index: nextIndex,
        download_profiles: [user_id]
      })
      .returning();

    return newSegment;
  }

  // Remove an audio segment
  async removeAudioSegment(
    segment_id: string,
    user_id: string
  ) {
    // Get the segment to check translation ownership
    const segment = await db.query.translation_audio_link.findFirst({
      where: eq(translation_audio_link.id, segment_id),
      with: {
        translation: true
      }
    });

    if (!segment?.translation) {
      throw new Error('Audio segment not found');
    }

    if (segment.translation.creator_id !== user_id) {
      throw new Error('Only the translation creator can remove audio segments');
    }

    const translationId = segment.translation.id;

    // Delete the segment
    await db.delete(translation_audio_link)
      .where(eq(translation_audio_link.id, segment_id));

    // Reorder remaining segments to close gaps
    const remainingSegments = await db.query.translation_audio_link.findMany({
      where: eq(translation_audio_link.translation_id, translationId),
      orderBy: (segments, { asc }) => [asc(segments.sequence_index)]
    });

    // Update sequence indices to close gaps
    const reorderPromises = remainingSegments.map((seg, index) =>
      db.update(translation_audio_link)
        .set({ sequence_index: index })
        .where(eq(translation_audio_link.id, seg.id))
    );

    await Promise.all(reorderPromises);
  }
}

export const translationService = new TranslationService();
