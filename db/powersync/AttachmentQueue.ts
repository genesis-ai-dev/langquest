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
    // TODO: make sure having two watches is not a problem (I think it will be a problem)

    this.db.watch(this.db.query.asset.findMany(), {
      onResult(assets) {
        const allAssets = assets.flatMap((asset) => [
          ...(asset.images ?? []),
          ...(asset.audio ?? [])
        ]);
        onUpdate(allAssets);
      }
    });

    this.db.watch(this.db.query.translation.findMany(), {
      onResult(translations) {
        const allAssets = translations
          .map((translation) => translation.audio)
          .filter(Boolean);
        onUpdate(allAssets);
      }
    });
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
