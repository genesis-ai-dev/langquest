import {
  AbstractAttachmentQueue,
  AttachmentQueueOptions,
  AttachmentRecord,
  AttachmentState
} from '@powersync/attachments';
import { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as drizzleSchema from '../drizzleSchema';
import { isNotNull } from 'drizzle-orm';
import { AppConfig } from '../supabase/AppConfig';

export class AttachmentQueue extends AbstractAttachmentQueue {
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor(
    options: AttachmentQueueOptions & {
      db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;
    }
  ) {
    super(options);
    this.db = options.db;
  }

  private initialized = false;

  async init() {
    if (this.initialized) {
      console.log('AttachmentQueue already initialized');
      return;
    }

    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up AttachmentQueue watches.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 0;
      return;
    }

    this.initialized = true;
    await super.init();
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
    record?: Partial<AttachmentRecord>,
    extension?: string
  ): Promise<AttachmentRecord> {
    const photoId = record?.id ?? randomUUID();
    // Assume jpeg if no extension provided for photos, adjust if needed
    const effectiveExtension = extension || 'jpeg'; 
    const filename =
      record?.filename ?? `${photoId}.${effectiveExtension}`;
    // const filenameWithoutPath = filename.split('/').pop() ?? filename;
    const localUri = this.getLocalFilePathSuffix(filename);

    // Determine default media type based on extension
    let defaultMediaType = 'application/octet-stream'; // Generic default
    if (['jpeg', 'jpg'].includes(effectiveExtension.toLowerCase())) {
      defaultMediaType = 'image/jpeg';
    } else if (effectiveExtension.toLowerCase() === 'png') {
      defaultMediaType = 'image/png';
    } // Add more image types if necessary
    else if (['m4a', 'mp4'].includes(effectiveExtension.toLowerCase())) {
        defaultMediaType = 'audio/aac'; // More specific for m4a/mp4
    } else if (['mp3', 'mpeg'].includes(effectiveExtension.toLowerCase())) {
        defaultMediaType = 'audio/mpeg';
    }

    return {
      state: AttachmentState.QUEUED_UPLOAD,
      id: filename,
      filename: filename,
      local_uri: localUri,
      media_type: defaultMediaType, // Set default media type
      ...record // Allow overriding if provided
    };
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    // Assuming photos are jpeg by default, pass extension to newAttachmentRecord
    const photoAttachment = await this.newAttachmentRecord({}, 'jpeg');
    const localUri = this.getLocalUri(photoAttachment.local_uri!);
    await this.storage.writeFile(localUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      photoAttachment.size = fileInfo.size;
    }
    // Ensure media_type is set if not already by newAttachmentRecord (though it should be now)
    if (!photoAttachment.media_type) {
        photoAttachment.media_type = 'image/jpeg'; 
    }

    return this.saveToQueue(photoAttachment);
  }

  async saveAudio(tempUri: string): Promise<AttachmentRecord> {
    const extension = tempUri.split('.').pop() || 'm4a'; // Default extension if none found
    // Pass determined extension and explicit media type to newAttachmentRecord
    // Let newAttachmentRecord determine default media type based on extension, but override if needed
    let mediaType = 'audio/mpeg'; // Default
    if (extension.toLowerCase() === 'm4a') mediaType = 'audio/aac';
    else if (extension.toLowerCase() === 'mp3') mediaType = 'audio/mpeg';
    
    const audioAttachment = await this.newAttachmentRecord(
      { media_type: mediaType }, // Explicitly provide media type
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
}
