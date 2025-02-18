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
import { isNotNull } from 'drizzle-orm';
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

  async init() {
    if (!AppConfig.supabaseBucket) {
      console.debug(
        'No Supabase bucket configured, skip setting up PhotoAttachmentQueue watches.'
      );
      // Disable sync interval to prevent errors from trying to sync to a non-existent bucket
      this.options.syncInterval = 0;
      return;
    }

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
}
