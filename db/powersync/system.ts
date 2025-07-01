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
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import Logger from 'js-logger';
import * as drizzleSchema from '../drizzleSchema';
import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { PermAttachmentQueue } from './PermAttachmentQueue';
import { TempAttachmentQueue } from './TempAttachmentQueue';
import { ATTACHMENT_QUEUE_LIMITS } from './constants';

Logger.useDefaults();

export class System {
  private static instance: System | null = null;

  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  permAttachmentQueue: PermAttachmentQueue | undefined = undefined;
  tempAttachmentQueue: TempAttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor() {
    // Prevent multiple instantiation
    if (System.instance) {
      throw new Error('System instance already exists. Use System.getInstance() instead.');
    }
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;

    const factory = new OPSqliteOpenFactory({
      dbFilename: 'sqlite.db',
      debugMode: false
    });

    this.powersync = new PowerSyncDatabase({
      schema: new Schema([
        ...new DrizzleAppSchema(drizzleSchema).tables,
        new AttachmentTable({
          additionalColumns: [
            new Column({ name: 'storage_type', type: ColumnType.TEXT })
          ]
        })
      ]),
      database: factory
    });

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
          _attachment: AttachmentRecord,
          _exception: { error: string; message: string; statusCode: number }
        ) => {
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
          _attachment: AttachmentRecord,
          _exception: unknown
        ) => {
          return { retry: true };
        }
      });
    }
  }

  static getInstance(): System {
    if (!System.instance) {
      System.instance = new System();
    }
    return System.instance;
  }

  private initialized = false;
  private connecting = false;
  private connectionPromise: Promise<void> | null = null;

  async init() {
    // If already connecting, wait for the existing connection
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already initialized and connected, return immediately
    if (this.initialized && this.powersync.connected) {
      return;
    }

    // Create a new connection promise
    this.connectionPromise = this._doInit();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _doInit() {
    try {
      this.connecting = true;

      // First initialize the database if not already done
      if (!this.initialized) {
        await this.powersync.init();
        // Freeze the object to prevent further modifications
        Object.freeze(this);
      }

      // If we're already connected, check if we need to reconnect
      if (this.powersync.connected) {
        // Check if the current user has changed
        const currentSession = await this.supabaseConnector.client.auth.getSession();
        const currentUserId = currentSession.data.session?.user.id;

        // Only disconnect and reconnect if there's a meaningful change
        if (currentUserId && this.lastConnectedUserId !== currentUserId) {
          console.log('User changed, reconnecting PowerSync...');
          await this.powersync.disconnect();
        } else {
          // Already connected with the same user
          this.initialized = true;
          return;
        }
      }

      // Connect with the current user credentials
      console.log('Connecting PowerSync...');
      await this.powersync.connect(this.supabaseConnector);

      // Store the current user ID
      const session = await this.supabaseConnector.client.auth.getSession();
      this.lastConnectedUserId = session.data.session?.user.id;

      // Wait for the initial sync to complete
      // await this.powersync.waitForFirstSync();

      this.initialized = true;
      // console.log('PowerSync initialization complete');

    } catch (error) {
      console.error('PowerSync initialization error:', error);
      this.initialized = false;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  private lastConnectedUserId?: string;

  isInitialized() {
    return this.initialized && this.powersync.connected;
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

      // Add timeout
      setTimeout(() => {
        console.warn('Sync timeout - proceeding anyway');
        unsubscribe();
        resolve();
      }, 10000); // 10 second timeout
    });
  }

  async cleanup() {
    try {
      // Note: AttachmentQueues don't have a stop method
      // They will be cleaned up when PowerSync disconnects

      // Disconnect PowerSync
      if (this.powersync.connected) {
        await this.powersync.disconnect();
      }

      this.initialized = false;
      this.lastConnectedUserId = undefined;
    } catch (error) {
      console.error('Error during system cleanup:', error);
    }
  }
}

// Create and export the system singleton safely
let systemInstance: System | null = null;

export function getSystem(): System {
  if (!systemInstance) {
    try {
      systemInstance = System.getInstance();
    } catch (error) {
      console.error('Failed to create system instance:', error);
      throw error;
    }
  }
  return systemInstance;
}

// Create a proxy that provides helpful error messages if accessed too early
export const system = new Proxy({} as System, {
  get(_target, prop, _receiver) {
    const instance = getSystem();
    const value = instance[prop as keyof System];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});
