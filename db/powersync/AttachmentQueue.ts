import {
  AbstractAttachmentQueue,
  AttachmentQueueOptions,
  AttachmentRecord,
  AttachmentState
} from '@powersync/attachments';
import { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { AppConfig } from '../supabase/AppConfig';
import * as drizzleSchema from '../drizzleSchema';
import { isNotNull, eq, and } from 'drizzle-orm';
import { system } from '../powersync/system';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';

export class AttachmentQueue extends AbstractSharedAttachmentQueue {
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
    console.log('Override init in AttachmentQueue entered............');
    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up AttachmentQueue watches.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 5000;
      return;
    }

    await super.init();
  }

  // Helper method to get the current user's ID
  async getCurrentUserId(): Promise<string | null> {
    try {
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('[DOWNLOAD WATCH] Error getting current user ID:', error);
      return null;
    }
  }

  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    // Watch for changes in ALL download records
    this.db.watch(this.db.query.asset_download.findMany(), {
      onResult: async (downloads) => {
        console.log('Download records changed:', downloads.length);
        const currentUserId = await this.getCurrentUserId();
        if (!currentUserId) {
          // User is logged out - don't delete anything, just stop syncing
          onUpdate([]);
          return;
        }

        // Filter to current user's downloads
        const userDownloads = downloads.filter(
          (download) => download.profile_id === currentUserId
        );
        console.log(`User downloads: ${userDownloads.length}`);

        // Split into active and inactive downloads
        const activeDownloads = userDownloads.filter(
          (download) => download.active === true
        );
        const inactiveDownloads = userDownloads.filter(
          (download) => download.active === false
        );

        console.log(
          `Active downloads: ${activeDownloads.length}, Inactive: ${inactiveDownloads.length}`
        );

        // Process inactive downloads - delete their attachments
        for (const download of inactiveDownloads) {
          const attachments = await this.getAllAssetAttachments(
            download.asset_id
          );
          for (const attachmentId of attachments) {
            // Delete each attachment from the queue
            await this.deleteFromQueue(attachmentId);
            console.log(
              `Deleted attachment ${attachmentId} for inactive asset ${download.asset_id}`
            );
          }
        }

        // Get all attachments for active assets
        const activeAttachments: string[] = [];
        for (const download of activeDownloads) {
          const attachments = await this.getAllAssetAttachments(
            download.asset_id
          );
          activeAttachments.push(...attachments);
        }

        // Remove duplicates
        const uniqueActiveAttachments = [...new Set(activeAttachments)];
        console.log(
          `Total active attachments to sync: ${uniqueActiveAttachments.length}`
        );

        // Tell PowerSync which attachments to keep synced
        onUpdate(uniqueActiveAttachments);
      }
    });

    // Watch for changes in asset content links
    this.db.watch(
      this.db.query.asset_content_link.findMany({
        where: (asset) => isNotNull(asset.audio_id)
      }),
      {
        onResult: async (assets) => {
          console.log(`Asset content links updated: ${assets.length}`);

          // Get current user ID
          const currentUserId = await this.getCurrentUserId();
          if (!currentUserId) {
            onUpdate([]);
            return;
          }

          // Get active downloads for current user
          const activeDownloads = await this.db.query.asset_download.findMany({
            where: (download) =>
              and(
                eq(download.profile_id, currentUserId),
                eq(download.active, true)
              )
          });

          const activeAssetIds = activeDownloads.map(
            (download) => download.asset_id
          );

          // Get all attachments for active assets
          const allAttachments: string[] = [];
          for (const assetId of activeAssetIds) {
            const assetAttachments = await this.getAllAssetAttachments(assetId);
            allAttachments.push(...assetAttachments);
          }

          // Remove duplicates
          const uniqueAttachments = [...new Set(allAttachments)];
          console.log(
            `Total unique attachments to sync: ${uniqueAttachments.length}`
          );

          // Update PowerSync
          onUpdate(uniqueAttachments);
        }
      }
    );

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
      await this.delete(record);
    }
  }

  async newAttachmentRecord(
    record?: Partial<AttachmentRecord>
  ): Promise<AttachmentRecord> {
    const photoId = record?.id ?? randomUUID();
    return {
      state: AttachmentState.QUEUED_UPLOAD,
      id: photoId,
      filename: photoId,
      ...record
    };
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = await this.newAttachmentRecord();
    photoAttachment.local_uri = this.getLocalFilePathSuffix(
      photoAttachment.filename
    );
    const localUri = this.getLocalUri(photoAttachment.local_uri);
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
    const audioAttachment = await this.newAttachmentRecord({
      media_type: 'audio/mpeg'
    });
    audioAttachment.local_uri = this.getLocalFilePathSuffix(
      audioAttachment.filename
    );
    const localUri = this.getLocalUri(audioAttachment.local_uri);
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
           state = ${AttachmentState.SYNCED} OR state = ${AttachmentState.ARCHIVED}
         ORDER BY
           timestamp DESC
         LIMIT 100 OFFSET ${this.options.cacheLimit}`);

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

  // Step 2: Identify all attachments related to an asset
  async getAllAssetAttachments(assetId: string): Promise<string[]> {
    console.log(
      `[ASSET ATTACHMENTS] Finding all attachments for asset: ${assetId}`
    );
    const attachmentIds: string[] = [];

    try {
      // 1. Get the asset itself for images
      const asset = await this.db.query.asset.findFirst({
        where: (a) => eq(a.id, assetId)
      });

      if (asset?.images) {
        console.log(
          `[ASSET ATTACHMENTS] Found ${asset.images.length} images in asset`
        );
        attachmentIds.push(...asset.images);
      }

      // 2. Get asset_content_link entries for audio
      const assetContents = await this.db.query.asset_content_link.findMany({
        where: (acl) => and(eq(acl.asset_id, assetId), isNotNull(acl.audio_id))
      });

      const contentAudioIds = assetContents
        .filter((content) => content.audio_id)
        .map((content) => content.audio_id!);

      if (contentAudioIds.length > 0) {
        console.log(
          `[ASSET ATTACHMENTS] Found ${contentAudioIds.length} audio files in asset_content_link`
        );
        attachmentIds.push(...contentAudioIds);
      }

      // 3. Get translations for the asset and their audio
      const translations = await this.db.query.translation.findMany({
        where: (t) => and(eq(t.asset_id, assetId), isNotNull(t.audio))
      });

      const translationAudioIds = translations
        .filter((translation) => translation.audio)
        .map((translation) => translation.audio!);

      if (translationAudioIds.length > 0) {
        console.log(
          `[ASSET ATTACHMENTS] Found ${translationAudioIds.length} audio files in translations`
        );
        attachmentIds.push(...translationAudioIds);
      }

      // Log all found attachments
      console.log(
        `[ASSET ATTACHMENTS] Total attachments for asset ${assetId}: ${attachmentIds.length}`
      );
      attachmentIds.forEach((id) =>
        console.log(`[ASSET ATTACHMENTS] - Attachment ID: ${id}`)
      );

      return attachmentIds;
    } catch (error) {
      console.error(
        `[ASSET ATTACHMENTS] Error getting attachments for asset ${assetId}:`,
        error
      );
      return [];
    }
  }
}
