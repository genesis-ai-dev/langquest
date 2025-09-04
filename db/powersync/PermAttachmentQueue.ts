import { system } from '@/db/powersync/system';
import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import { AttachmentState } from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { isNotNull } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system';
import type * as drizzleSchema from '../drizzleSchema';
import { AppConfig } from '../supabase/AppConfig';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';

export class PermAttachmentQueue extends AbstractSharedAttachmentQueue {
  // db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  // Track previous active downloads to detect changes
  // previousActiveDownloads: {
  //   profile_id: string;
  //   asset_id: string;
  //   active: boolean;
  // }[] = [];

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
    }
  ) {
    super(options);
    // this.db = options.db;
  }

  async getCurrentUserId(): Promise<string | null> {
    // Get user from Supabase auth session
    const session = await system.supabaseConnector.client.auth.getSession();
    return session.data.session?.user.id || null;
  }

  getStorageType(): 'permanent' | 'temporary' {
    return 'permanent';
  }

  async init() {
    console.log('PermAttachmentQueue init');
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
    console.log('onAttachmentIdsChange in PERM ATTACHMENT QUEUE');

    // Use the getCurrentUserId method instead of getCurrentUser
    void this.getCurrentUserId().then((currentUserId) => {
      if (!currentUserId) {
        return;
      }

      let isRefreshing = false;
      let debounceTimeout: number | null = null;

      // Unified function to query all tables and update PowerSync with complete list
      const refreshAllAttachments = async () => {
        if (isRefreshing) {
          console.log('Refresh already in progress, skipping...');
          return;
        }
        isRefreshing = true;

        console.log('Refreshing all attachments from all tables');

        try {
          // Query all three tables fresh to get current state
          const [assets, assetContentLinks, translations] = await Promise.all([
            this.db.query.asset.findMany({
              columns: { images: true },
              where: (asset) => isNotNull(asset.images)
            }),
            this.db.query.asset_content_link.findMany({
              columns: { audio_id: true },
              where: (asset_content_link) =>
                isNotNull(asset_content_link.audio_id)
            }),
            this.db.query.translation.findMany({
              columns: { audio: true },
              where: (translation) => isNotNull(translation.audio)
            })
          ]);

          // Collect all attachment IDs
          const assetImages = assets.flatMap((asset) => asset.images!);
          const contentLinkAudioIds = assetContentLinks.map(
            (link) => link.audio_id!
          );
          const translationAudioIds = translations.map(
            (translation) => translation.audio!
          );

          // Merge and deduplicate
          const allAttachments = [
            ...assetImages,
            ...contentLinkAudioIds,
            ...translationAudioIds
          ];
          const uniqueAttachments = [...new Set(allAttachments)];

          console.log(
            `Total unique attachments to sync: ${uniqueAttachments.length}`,
            {
              assetImages: assetImages.length,
              contentLinkAudioIds: contentLinkAudioIds.length,
              translationAudioIds: translationAudioIds.length
            }
          );

          console.log(
            'RYDER: about to call onUpdate with ',
            uniqueAttachments.length,
            'attachments'
          );
          // Tell PowerSync which attachments to keep synced
          onUpdate(uniqueAttachments);
        } catch (error) {
          console.error('Error refreshing attachments:', error);
        } finally {
          isRefreshing = false;
        }
      };

      // Debounced refresh function
      const debouncedRefresh = () => {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
          void refreshAllAttachments();
        }, 500);
      };

      // Watch for changes in asset images - trigger debounced refresh
      this.db.watch(
        this.db.query.asset.findMany({
          columns: { images: true },
          where: (asset) => isNotNull(asset.images)
        }),
        {
          onResult: () => {
            console.log('Asset images changed - triggering debounced refresh');
            debouncedRefresh();
          }
        }
      );

      // Watch for changes in asset content link audio - trigger debounced refresh
      this.db.watch(
        this.db.query.asset_content_link.findMany({
          columns: { audio_id: true },
          where: (asset_content_link) => isNotNull(asset_content_link.audio_id)
        }),
        {
          onResult: () => {
            console.log(
              'Asset content links changed - triggering debounced refresh'
            );
            debouncedRefresh();
          }
        }
      );

      // Watch for changes in translation audio - trigger debounced refresh
      this.db.watch(
        this.db.query.translation.findMany({
          columns: { audio: true },
          where: (translation) => isNotNull(translation.audio)
        }),
        {
          onResult: () => {
            console.log('Translations changed - triggering debounced refresh');
            debouncedRefresh();
          }
        }
      );

      // Initial load
      void refreshAllAttachments();
    });
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      await this.delete(record);
    }
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = await this.newAttachmentRecord();
    const localUri = this.getLocalUri(photoAttachment.local_uri!);
    await this.storage.writeFile(localUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      photoAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(photoAttachment);
  }

  async saveAudio(tempUri: string): Promise<AttachmentRecord> {
    const extension = tempUri.split('.').pop();
    const audioAttachment = await this.newAttachmentRecord(
      {
        media_type: 'audio/mpeg'
      },
      extension
    );
    const localUri = this.getLocalUri(audioAttachment.local_uri!);
    await FileSystem.moveAsync({
      from: tempUri,
      to: localUri
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      audioAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(audioAttachment);
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
