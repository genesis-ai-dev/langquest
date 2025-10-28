import { system } from '@/db/powersync/system';
import type { AttachmentRecord } from '@powersync/attachments';
import { ATTACHMENT_TABLE } from '@powersync/attachments';

export interface CorruptedAttachment {
  attachmentRecord: AttachmentRecord;
  assetContentLinks: Array<{
    id: string;
    asset_id: string;
    audio: string[] | null;
  }>;
  assets: Array<{
    id: string;
    name: string | null;
  }>;
}

/**
 * Find all corrupted attachments in the database.
 * Corrupted attachments are those with blob URLs in id, local_uri, or filename fields.
 */
export async function findCorruptedAttachments(): Promise<
  CorruptedAttachment[]
> {
  try {
    console.log('[CorruptedAttachments] Scanning for corrupted attachments...');

    // Query for attachments with blob URLs
    const corruptedRecords = await system.powersync.getAll<AttachmentRecord>(
      `SELECT * FROM ${ATTACHMENT_TABLE} 
       WHERE id LIKE '%blob:%' 
          OR local_uri LIKE '%blob:%' 
          OR filename LIKE '%blob:%'
       ORDER BY timestamp DESC`
    );

    console.log(
      `[CorruptedAttachments] Found ${corruptedRecords.length} corrupted attachment records`
    );

    if (corruptedRecords.length === 0) {
      return [];
    }

    // For each corrupted attachment, find related asset_content_links and assets
    const results: CorruptedAttachment[] = [];

    for (const attachmentRecord of corruptedRecords) {
      try {
        // Find asset_content_link records that reference this attachment
        // Note: audio is a JSON array, so we need to check if it contains the attachment ID
        const contentLinks = await system.db.query.asset_content_link.findMany({
          columns: {
            id: true,
            asset_id: true,
            audio: true
          },
          where: (fields, { sql }) =>
            sql`json_extract(${fields.audio}, '$') LIKE ${'%' + attachmentRecord.id + '%'}`
        });

        console.log(
          `[CorruptedAttachments] Found ${contentLinks.length} content links for attachment ${attachmentRecord.id.substring(0, 20)}`
        );

        // Get unique asset IDs
        const assetIds = [
          ...new Set(contentLinks.map((link) => link.asset_id))
        ];

        // Fetch asset details
        const assets: Array<{ id: string; name: string | null }> = [];
        for (const assetId of assetIds) {
          const asset = await system.db.query.asset.findFirst({
            columns: {
              id: true,
              name: true
            },
            where: (fields, { eq }) => eq(fields.id, assetId)
          });

          if (asset) {
            assets.push(asset);
          }
        }

        results.push({
          attachmentRecord,
          assetContentLinks: contentLinks,
          assets
        });
      } catch (error) {
        console.error(
          `[CorruptedAttachments] Error processing attachment ${attachmentRecord.id}:`,
          error
        );
        // Continue with other attachments even if one fails
        results.push({
          attachmentRecord,
          assetContentLinks: [],
          assets: []
        });
      }
    }

    console.log(
      `[CorruptedAttachments] Processed ${results.length} corrupted attachments with context`
    );

    return results;
  } catch (error) {
    console.error(
      '[CorruptedAttachments] Error finding corrupted attachments:',
      error
    );
    throw error;
  }
}

/**
 * Clean up a single corrupted attachment.
 * This will:
 * 1. Remove the attachment record from the attachments table
 * 2. Remove references from asset_content_link audio arrays
 */
export async function cleanupCorruptedAttachment(
  attachmentId: string
): Promise<void> {
  try {
    console.log(
      `[CorruptedAttachments] Cleaning up attachment: ${attachmentId.substring(0, 20)}`
    );

    // 1. Find all asset_content_link records that reference this attachment
    const contentLinks = await system.db.query.asset_content_link.findMany({
      columns: {
        id: true,
        audio: true
      },
      where: (fields, { sql }) =>
        sql`json_extract(${fields.audio}, '$') LIKE ${'%' + attachmentId + '%'}`
    });

    console.log(
      `[CorruptedAttachments] Found ${contentLinks.length} content links to clean`
    );

    // 2. Use PowerSync writeTransaction for atomic updates
    await system.powersync.writeTransaction(async (tx) => {
      // Update each content link to remove the corrupted attachment ID
      for (const link of contentLinks) {
        if (link.audio) {
          const updatedAudio = link.audio.filter((id) => id !== attachmentId);

          // Use raw SQL update since PowerSync doesn't use Drizzle for writes
          await tx.execute(
            `UPDATE asset_content_link SET audio = ? WHERE id = ?`,
            [JSON.stringify(updatedAudio), link.id]
          );

          console.log(
            `[CorruptedAttachments] Updated content link ${link.id} audio array`
          );
        }
      }

      // Delete the attachment record
      await tx.execute(`DELETE FROM ${ATTACHMENT_TABLE} WHERE id = ?`, [
        attachmentId
      ]);

      console.log(
        `[CorruptedAttachments] Deleted attachment record: ${attachmentId.substring(0, 20)}`
      );
    });

    console.log(
      `[CorruptedAttachments] Successfully cleaned up attachment: ${attachmentId.substring(0, 20)}`
    );
  } catch (error) {
    console.error(
      `[CorruptedAttachments] Error cleaning up attachment ${attachmentId}:`,
      error
    );
    throw error;
  }
}

/**
 * Clean up all corrupted attachments.
 * Returns the number of attachments cleaned and any errors encountered.
 */
export async function cleanupAllCorrupted(): Promise<{
  cleaned: number;
  errors: string[];
}> {
  try {
    console.log(
      '[CorruptedAttachments] Starting cleanup of all corrupted attachments...'
    );

    const corrupted = await findCorruptedAttachments();
    const errors: string[] = [];
    let cleaned = 0;

    for (const item of corrupted) {
      try {
        await cleanupCorruptedAttachment(item.attachmentRecord.id);
        cleaned++;
      } catch (error) {
        const errorMsg = `Failed to clean ${item.attachmentRecord.id.substring(0, 20)}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[CorruptedAttachments] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(
      `[CorruptedAttachments] Cleanup complete: ${cleaned} cleaned, ${errors.length} errors`
    );

    return { cleaned, errors };
  } catch (error) {
    console.error(
      '[CorruptedAttachments] Error in cleanupAllCorrupted:',
      error
    );
    throw error;
  }
}

/**
 * Get a count of corrupted attachments without full details.
 * Useful for badges and quick checks.
 */
export async function getCorruptedCount(): Promise<number> {
  try {
    const result = await system.powersync.getOptional<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${ATTACHMENT_TABLE} 
       WHERE id LIKE '%blob:%' 
          OR local_uri LIKE '%blob:%' 
          OR filename LIKE '%blob:%'`
    );

    return result?.count ?? 0;
  } catch (error) {
    console.error(
      '[CorruptedAttachments] Error getting corrupted count:',
      error
    );
    return 0;
  }
}
