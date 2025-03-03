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

export class AttachmentQueue extends AbstractAttachmentQueue {
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
  // Track previous active downloads to detect changes
  previousActiveDownloads: {
    profile_id: string;
    asset_id: string;
    active: boolean;
  }[] = [];

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
    }
  ) {
    super(options);
    this.db = options.db;
  }

  async init() {
    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up AttachmentQueue watches.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 0;
      return;
    }

    // Set up watch for asset_download table to detect changes in download preferences
    await this.watchAssetDownloads();

    await super.init();
  }

  // Step 1: Watch for changes in the asset_download table
  async watchAssetDownloads() {
    try {
      console.log('[DOWNLOAD WATCH] Setting up watch for asset_download table');

      // Get the current user's profile ID
      const currentUserId = await this.getCurrentUserId();
      console.log(`[DOWNLOAD WATCH] Current user ID: ${currentUserId}`);

      if (currentUserId) {
        // Watch for changes in the current user's downloads
        this.db.watch(
          this.db.query.asset_download.findMany({
            where: (ad) => eq(ad.profile_id, currentUserId)
          }),
          {
            onResult: async (downloads) => {
              // Log the count of active downloads
              const activeDownloads = downloads.filter(
                (d) => d.active === true
              );
              console.log(
                `[DOWNLOAD WATCH] User ${currentUserId} downloads changed: ${downloads.length} total, ${activeDownloads.length} active`
              );

              // Process each active download - identify all related attachments
              for (const download of activeDownloads) {
                console.log(
                  `[DOWNLOAD WATCH] Active download: asset=${download.asset_id}`
                );

                // Step 2 testing: When asset is selected for download, identify all its attachments
                const attachments = await this.getAllAssetAttachments(
                  download.asset_id
                );
                console.log(
                  `[DOWNLOAD WATCH] Asset ${download.asset_id} has ${attachments.length} total attachments`
                );
              }
            }
          }
        );
      }

      console.log(
        '[DOWNLOAD WATCH] Watch for asset_download table established successfully'
      );
    } catch (error) {
      console.error(
        '[DOWNLOAD WATCH] Error setting up asset_download watch:',
        error
      );
    }
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
    let lastAssetImages: string[] = [];
    let lastAssetAudio: string[] = [];
    let lastTranslations: string[] = [];

    this.db.watch(
      this.db.query.asset_content_link.findMany({
        where: (asset) => isNotNull(asset.audio_id)
      }),
      {
        onResult(assets) {
          const allAudioAssets = assets.map((asset) => asset.audio_id!);
          onUpdate([
            ...allAudioAssets,
            ...lastAssetImages,
            ...lastTranslations
          ]);
          lastAssetAudio = allAudioAssets;
        }
      }
    );

    this.db.watch(
      this.db.query.asset.findMany({
        where: (asset) => isNotNull(asset.images)
      }),
      {
        onResult(assets) {
          console.log('watched assets', assets);
          const allImageAssets = assets.flatMap((asset) => asset.images!);
          onUpdate([...lastAssetAudio, ...allImageAssets, ...lastTranslations]);
          lastAssetImages = allImageAssets;
        }
      }
    );

    this.db.watch(
      this.db.query.translation.findMany({
        where: (translation) => isNotNull(translation.audio)
      }),
      {
        onResult(translations) {
          const allTranslations = translations.map(
            (translation) => translation.audio!
          );
          onUpdate([...lastAssetAudio, ...lastAssetImages, ...allTranslations]);
          lastTranslations = allTranslations;
        }
      }
    );
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
