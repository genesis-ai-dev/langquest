import type {
  AttachmentQueueOptions,
  AttachmentRecord
} from '@powersync/attachments';
import { AttachmentState } from '@powersync/attachments';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import * as FileSystem from 'expo-file-system';
import type * as drizzleSchema from '../drizzleSchema';
import { AppConfig } from '../supabase/AppConfig';
// import { system } from '../powersync/system';
import { getCurrentUser } from '@/contexts/AuthContext';
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

  getStorageType(): 'permanent' | 'temporary' {
    return 'permanent';
  }

  async init() {
    console.log('Override init in PermAttachmentQueue entered............');
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

  // Helper method to get the current user's ID
  // async getCurrentUserId(): Promise<string | null> {
  //   try {
  //     const {
  //       data: { session }
  //     } = await system.supabaseConnector.client.auth.getSession();
  //     return session?.user?.id || null;
  //   } catch (error) {
  //     console.error('[DOWNLOAD WATCH] Error getting current user ID:', error);
  //     return null;
  //   }
  // }

  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      console.log('No current user, skipping attachment queue');
      return;
    }

    // Watch for changes in ALL download records
    this.db.watch(this.db.query.asset.findMany(), {
      onResult: (assets) => {
        console.log('Download records changed:');
        // const currentUserId = await this.getCurrentUserId();
        // if (!currentUserId) {
        //   // User is logged out - don't delete anything, just stop syncing
        //   onUpdate([]);
        //   return;
        // }

        // Filter to current user's downloads
        // const userDownloads = downloads.filter(
        //   (download) => download.profile_id === currentUserId
        // );
        // console.log(`User downloads: ${userDownloads.length}`);

        // Split into active and inactive downloads
        const runAsync = async () => {
          // Get all attachments for active assets
          const activeAttachments: string[] = [];
          for (const asset of assets) {
            const attachments = await this.getAllAssetAttachments(asset.id);
            activeAttachments.push(...attachments);
          }

          // Remove duplicates
          const uniqueActiveAttachments = [...new Set(activeAttachments)];
          console.log(
            `Total active attachments to sync: ${uniqueActiveAttachments.length}`
          );

          // Tell PowerSync which attachments to keep synced
          onUpdate(uniqueActiveAttachments);
        };

        void runAsync();
      }
    });

    // Watch for changes in asset content links
    // this.db.watch(
    //   this.db.query.asset_content_link.findMany({
    //     where: (asset) => isNotNull(asset.audio_id)
    //   }),
    //   {
    //     onResult: (assetContentLinks) => {
    //       console.log(
    //         `Asset content links updated: ${assetContentLinks.length}`
    //       );
    //       const runAsync = async () => {
    //         // Get current user ID
    //         // const currentUserId = await this.getCurrentUserId();
    //         // if (!currentUserId) {
    //         //   onUpdate([]);
    //         //   return;
    //         // }

    //         const activeAssetIds = assetContentLinks.map(
    //           (assetContentLink) => assetContentLink.asset_id
    //         );

    //         // Get all attachments for active assets
    //         const allAttachments: string[] = [];
    //         for (const assetId of activeAssetIds) {
    //           const assetAttachments =
    //             await this.getAllAssetAttachments(assetId);
    //           allAttachments.push(...assetAttachments);
    //         }

    //         // Remove duplicates
    //         const uniqueAttachments = [...new Set(allAttachments)];
    //         console.log(
    //           `Total unique attachments to sync: ${uniqueAttachments.length}`
    //         );

    //         // Update PowerSync
    //         onUpdate(uniqueAttachments);
    //       };

    //       void runAsync();
    //     }
    //   }
    // );

    // this.db.watch(
    //   this.db.query.asset.findMany({
    //     where: (asset) => isNotNull(asset.images)
    //   }),
    //   {
    //     onResult(assets) {
    //       console.log('watched assets', assets);
    //       const allImageAssets = assets.flatMap((asset) => asset.images!);
    //       onUpdate([...lastAssetAudio, ...allImageAssets, ...lastTranslations]);
    //       lastAssetImages = allImageAssets;
    //     }
    //   }
    // );

    // this.db.watch(
    //   this.db.query.translation.findMany({
    //     where: (translation) => isNotNull(translation.audio)
    //   }),
    //   {
    //     onResult(translations) {
    //       const allTranslations = translations.map(
    //         (translation) => translation.audio!
    //       );
    //       onUpdate([...lastAssetAudio, ...lastAssetImages, ...allTranslations]);
    //       lastTranslations = allTranslations;
    //     }
    //   }
    // );
  }

  async deleteFromQueue(attachmentId: string): Promise<void> {
    const record = await this.record(attachmentId);
    if (record) {
      console.log(`Record found, deleting attachment: ${attachmentId}`);
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
