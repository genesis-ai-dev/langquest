import '@azure/core-asynciterator-polyfill';
import type { PowerSyncSQLiteDatabase } from '@powersync/drizzle-driver';
import {
  DrizzleAppSchema,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';
import 'react-native-url-polyfill/auto';

import {
  Column,
  ColumnType,
  PowerSyncDatabase,
  Schema
} from '@powersync/react-native';
import type { SupabaseStorageAdapter } from '../supabase/SupabaseStorageAdapter';

import type { AttachmentRecord } from '@powersync/attachments';
import { AttachmentTable } from '@powersync/attachments';
import Logger from 'js-logger';
import * as drizzleSchema from '../drizzleSchema';
import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { PermAttachmentQueue } from './PermAttachmentQueue';
import { TempAttachmentQueue } from './TempAttachmentQueue';
import { ATTACHMENT_QUEUE_LIMITS } from './constants';

Logger.useDefaults();

export class System {
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  permAttachmentQueue: PermAttachmentQueue | undefined = undefined;
  tempAttachmentQueue: TempAttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor() {
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;
    this.powersync = new PowerSyncDatabase({
      schema: new Schema([
        ...new DrizzleAppSchema(drizzleSchema).tables,
        new AttachmentTable({
          additionalColumns: [
            new Column({ name: 'storage_type', type: ColumnType.TEXT })
          ]
        })
      ]),
      database: {
        dbFilename: 'sqlite.db',
        debugMode: true
      }
    });

    console.log('Wrapping PowerSync with Drizzle');
    this.db = wrapPowerSyncWithDrizzle(this.powersync, {
      schema: drizzleSchema
    });

    if (AppConfig.supabaseBucket) {
      this.permAttachmentQueue = new PermAttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        db: this.db,
        attachmentDirectoryName: 'shared_attachments',
        cacheLimit: ATTACHMENT_QUEUE_LIMITS.PERMANENT,
        // eslint-disable-next-line
        onDownloadError: async (
          attachment: AttachmentRecord,
          exception: { toString: () => string; status?: number }
        ) => {
          if (
            exception.toString() === 'StorageApiError: Object not found' ||
            exception.status === 400 ||
            exception.toString().includes('status":400')
          ) {
            return { retry: false };
          }

          return { retry: true };
        },
        // eslint-disable-next-line
        onUploadError: async (
          attachment: AttachmentRecord,
          exception: unknown
        ) => {
          console.log('onUploadError', attachment, exception);
          return { retry: true };
        }
      });

      this.tempAttachmentQueue = new TempAttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        db: this.db,
        attachmentDirectoryName: 'shared_attachments',
        cacheLimit: ATTACHMENT_QUEUE_LIMITS.TEMPORARY,
        // eslint-disable-next-line
        onDownloadError: async (
          attachment: AttachmentRecord,
          exception: { toString: () => string; status?: number }
        ) => {
          console.log(
            'TempAttachmentQueue onDownloadError',
            attachment,
            exception
          );
          if (
            exception.toString() === 'StorageApiError: Object not found' ||
            exception.status === 400 ||
            exception.toString().includes('status":400')
          ) {
            return { retry: false };
          }

          return { retry: true };
        },
        // eslint-disable-next-line
        onUploadError: async (
          attachment: AttachmentRecord,
          exception: unknown
        ) => {
          console.log('onUploadError', attachment, exception);
          return { retry: true };
        }
      });
    }
  }

  private initialized = false;
  private connecting = false;

  async init() {
    if (this.connecting) {
      return;
    }

    try {
      this.connecting = true;

      // First initialize the database if not already done
      if (!this.initialized) await this.powersync.init();

      // // If we're already connected, disconnect first
      // // This is to ensure that we can access user-specific sync bucket records with current user credentials
      if (this.powersync.connected) {
        console.log(
          'Disconnecting existing PowerSync connection before reconnecting'
        );
        await this.powersync.disconnect();
      }

      // Connect with the current user credentials
      console.log('Connecting PowerSync with current user credentials');
      await this.powersync.connect(this.supabaseConnector);

      // Wait for the latest sync to complete
      await this.waitForLatestSync();

      this.initialized = true;
    } catch (error) {
      console.error('PowerSync initialization error:', error);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  async waitForLatestSync() {
    console.log('Waiting for latest PowerSync data sync to complete...');

    // Create a promise that resolves when a new sync completes after this point
    return new Promise<void>((resolve) => {
      const initialTimestamp =
        this.powersync.currentStatus.lastSyncedAt?.getTime() ?? 0;
      console.log(`Current lastSyncedAt timestamp: ${initialTimestamp}`);

      const unsubscribe = this.powersync.registerListener({
        statusChanged: (status) => {
          // Check if we have a new sync completion timestamp
          const newTimestamp = status.lastSyncedAt?.getTime() ?? 0;

          if (newTimestamp > initialTimestamp) {
            console.log(
              `New sync completed at: ${status.lastSyncedAt?.toISOString()}`
            );
            unsubscribe(); // Remove the listener
            resolve();
          }
        }
      });
    });
  }
}

export const system = new System();
