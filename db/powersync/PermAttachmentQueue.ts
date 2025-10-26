import {
  getFileInfo,
  getFileName,
  getLocalUri,
  moveFile
} from '@/utils/fileUtils';
import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import { AttachmentState } from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import type * as drizzleSchema from '../drizzleSchema';
import {
  asset_content_link_synced,
  asset_synced
} from '../drizzleSchemaSynced';
import { AppConfig } from '../supabase/AppConfig';
import type { SupabaseConnector } from '../supabase/SupabaseConnector';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';

export class PermAttachmentQueue extends AbstractSharedAttachmentQueue {
  // db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  // Track previous active downloads to detect changes
  // previousActiveDownloads: {
  //   profile_id: string;
  //   asset_id: string;
  //   active: boolean;
  // }[] = [];
  private supabaseConnector: SupabaseConnector;

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
      supabaseConnector: SupabaseConnector;
    }
  ) {
    super(options);
    // this.db = options.db;
    this.supabaseConnector = options.supabaseConnector;
  }

  getLocalUri(filePath: string) {
    return getLocalUri(filePath);
  }

  async getCurrentUserId() {
    // Get user from Supabase auth session
    const session = await this.supabaseConnector.client.auth.getSession();
    return session.data.session?.user.id || null;
  }

  getStorageType(): 'permanent' | 'temporary' {
    return 'permanent';
  }

  async init() {
    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up PermAttachmentQueue watches.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 0; // This is weird, shouldn't be here
      return;
    }

    await super.init();
  }

  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    // Use the getCurrentUserId method instead of getCurrentUser
    void this.getCurrentUserId().then((currentUserId) => {
      if (!currentUserId) {
        return;
      }

      const query = this.db
        .select({
          images: asset_synced.images,
          audio: asset_content_link_synced.audio
        })
        .from(asset_synced)
        .leftJoin(
          asset_content_link_synced,
          eq(asset_synced.id, asset_content_link_synced.asset_id)
        )
        .where(
          and(
            or(
              isNotNull(asset_content_link_synced.audio),
              isNotNull(asset_synced.images)
            )
          )
        );

      function refreshAllAttachments(data: Awaited<typeof query>) {
        const assetImages = data
          .flatMap((asset_synced) => asset_synced.images)
          .filter(Boolean);
        const contentLinkAudioIds = data
          .flatMap(
            (asset_content_link_synced) => asset_content_link_synced.audio
          )
          .filter(Boolean);
        const allAttachments = [...assetImages, ...contentLinkAudioIds];
        const uniqueAttachments = [...new Set(allAttachments)];

        console.log(
          `Total unique attachments to sync: ${uniqueAttachments.length}`,
          {
            assetImages: assetImages.length,
            contentLinkAudioIds: contentLinkAudioIds.length
          }
        );

        // Tell PowerSync which attachments to keep synced
        onUpdate(uniqueAttachments);
      }

      // Watch for changes in asset content link audio - trigger debounced refresh
      this.db.watch(query, {
        onResult: (data) => refreshAllAttachments(data)
      });

      // Initial load
      void query.then((data) => refreshAllAttachments(data));
    });
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      await this.delete(record);
    }
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = await this.newAttachmentRecord({
      id: getFileName(base64Data)!
    });
    const localUri = this.getLocalUri(photoAttachment.local_uri!);
    const fileInfo = await getFileInfo(localUri);
    if (fileInfo.exists) {
      await moveFile(localUri, base64Data);
      photoAttachment.size = fileInfo.size;
    }
    return this.saveToQueue(photoAttachment);
  }

  async saveAudio(
    tempUri: string,
    tx?: Parameters<Parameters<typeof this.db.transaction>[0]>[0]
  ): Promise<AttachmentRecord> {
    const recordId = getFileName(tempUri)!;
    const audioAttachment = await this.newAttachmentRecord({
      id: recordId
    });

    const localUri = this.getLocalUri(audioAttachment.local_uri!);
    const fileInfo = await getFileInfo(tempUri);

    if (fileInfo.exists) {
      await moveFile(tempUri, localUri);
      audioAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(audioAttachment, tx);
  }

  async expireCache() {
    const res = await this.powersync
      .getAll<AttachmentRecord>(`SELECT * FROM ${this.table}
          WHERE
           state = ${AttachmentState.ARCHIVED} AND storage_type = 'permanent'
         ORDER BY
           timestamp DESC
         LIMIT 100`);

    if (res.length == 0) {
      return;
    }

    console.debug(`Deleting ${res.length} permanent attachments`);

    await this.powersync.writeTransaction(async (tx) => {
      for (const record of res) {
        await this.delete(record, tx);
      }
    });
  }
}
