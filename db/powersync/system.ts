import '@azure/core-asynciterator-polyfill';
import type {
  DrizzleTableWithPowerSyncOptions,
  PowerSyncSQLiteDatabase
} from '@powersync/drizzle-driver';
import {
  DrizzleAppSchema,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';
import 'react-native-url-polyfill/auto';

// Import from native SDK - will be empty on web
import {
  Column as ColumnNative,
  ColumnType as ColumnTypeNative,
  PowerSyncDatabase as PowerSyncDatabaseNative,
  Schema as SchemaNative
} from '@powersync/react-native';

// Import from web SDK - will be empty on native
import {
  ColumnType as ColumnTypeWeb,
  Column as ColumnWeb,
  PowerSyncDatabase as PowerSyncDatabaseWeb,
  Schema as SchemaWeb,
  WASQLiteOpenFactory
} from '@powersync/web';

import type { SupabaseStorageAdapter } from '../supabase/SupabaseStorageAdapter';

import type { AttachmentRecord } from '@powersync/attachments';
import { AttachmentTable } from '@powersync/attachments';
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import Logger from 'js-logger';
import { Platform } from 'react-native';
import * as drizzleSchema from '../drizzleSchema';
import * as drizzleSchemaLocal from '../drizzleSchemaLocal';
import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { PermAttachmentQueue } from './PermAttachmentQueue';
import { TempAttachmentQueue } from './TempAttachmentQueue';
import { ATTACHMENT_QUEUE_LIMITS } from './constants';

const {
  quest_tag_categories: _,
  asset_tag_categories: _2,
  ...tablesOnly
} = drizzleSchema;

export { tablesOnly };

const {
  quest_tag_categories_local: _local,
  asset_tag_categories_local: _local2,
  ...localTablesOnly
} = drizzleSchemaLocal;

export { localTablesOnly };

// Use the correct imports based on platform
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Column = ColumnNative || ColumnWeb;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const ColumnType = ColumnTypeNative || ColumnTypeWeb;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Schema = SchemaNative || SchemaWeb;
// const SyncClientImplementation =
//   SyncClientImplementationNative || SyncClientImplementationWeb;

Logger.useDefaults();

export class System {
  private static instance: System | null = null;

  factory: WASQLiteOpenFactory | OPSqliteOpenFactory;
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabaseNative | PowerSyncDatabaseWeb;
  permAttachmentQueue: PermAttachmentQueue | undefined = undefined;
  tempAttachmentQueue: TempAttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema & typeof drizzleSchemaLocal>;

  // Add tracking for attachment queue initialization
  private attachmentQueuesInitialized = false;
  private attachmentQueueInitPromise: Promise<void> | null = null;

  constructor() {
    // Prevent multiple instantiation
    if (System.instance) {
      throw new Error(
        'System instance already exists. Use System.getInstance() instead.'
      );
    }
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;

    const drizzleSchemaWithOptions = {
      ...tablesOnly,
      ...Object.entries(localTablesOnly).reduce(
        (acc, [key, localTable]) => {
          console.log('key', key, key.replace('_local', ''));
          acc[key] = {
            tableDefinition: localTable,
            options: { localOnly: true }
          } as DrizzleTableWithPowerSyncOptions;
          return acc;
        },
        {} as Record<string, DrizzleTableWithPowerSyncOptions>
      )
    };

    const schema = new Schema([
      ...new DrizzleAppSchema(drizzleSchemaWithOptions).tables,
      new AttachmentTable({
        additionalColumns: [
          new Column({ name: 'storage_type', type: ColumnType.TEXT })
        ]
      })
    ]);

    // Check if we're on native or web platform
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (PowerSyncDatabaseNative) {
      this.factory = new OPSqliteOpenFactory({
        dbFilename: 'sqlite.db',
        debugMode: false
      });
      this.powersync = new PowerSyncDatabaseNative({
        schema,
        database: this.factory
      });
    } else {
      this.factory = new WASQLiteOpenFactory({
        dbFilename: 'sqlite.db',
        worker: '/@powersync/worker/WASQLiteDB.umd.js',
        debugMode: false
      });
      this.powersync = new PowerSyncDatabaseWeb({
        schema,
        database: this.factory,
        sync: {
          worker: '/@powersync/worker/SharedSyncImplementation.umd.js'
        }
      });
    }
    this.db = wrapPowerSyncWithDrizzle(this.powersync, {
      schema: { ...drizzleSchema, ...drizzleSchemaLocal }
    });

    if (AppConfig.supabaseBucket) {
      this.permAttachmentQueue = new PermAttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        db: this.db,
        attachmentDirectoryName: 'shared_attachments',
        cacheLimit: ATTACHMENT_QUEUE_LIMITS.PERMANENT,
        downloadAttachments: Platform.OS !== 'web',
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

      if (Platform.OS !== 'web') {
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
      console.log('PowerSync initialized:', this.initialized);
      if (!this.initialized) {
        console.log('Initializing PowerSync...');
        await this.powersync.init();
        // Freeze the object to prevent further modifications
        // Object.freeze(this);
      }

      // If we're already connected, check if we need to reconnect
      console.log('PowerSync connected:', this.powersync.connected);
      // if (this.powersync.connected) {
      //   // Check if the current user has changed
      //   console.log('Getting current session...');
      // const currentSession =
      //   await this.supabaseConnector.client.auth.getSession();
      // console.log('Current session:', currentSession);
      // const currentUserId = currentSession.data.session?.user.id;
      // console.log('Current user ID:', currentUserId);
      //   const currentUserId = this.supabaseConnector.getUserProfile()?.id;

      //   // Only disconnect and reconnect if there's a meaningful change
      //   console.log('Last connected user ID:', this.lastConnectedUserId);
      //   if (currentUserId && this.lastConnectedUserId !== currentUserId) {
      //     console.log('User changed, reconnecting PowerSync...');
      //     await this.powersync.disconnect();
      //     // Reset attachment queue initialization state
      //     this.attachmentQueuesInitialized = false;
      //     this.attachmentQueueInitPromise = null;
      //   } else {
      //     // Already connected with the same user
      //     console.log('Already connected with the same user');
      //     this.initialized = true;
      //     // Still need to ensure attachment queues are initialized
      //     if (!this.attachmentQueuesInitialized) {
      //       console.log('Initializing attachment queues...');
      //       await this.initializeAttachmentQueues();
      //     }
      //     return;
      //   }
      // }

      // Connect with the current user credentials
      console.log('Connecting PowerSync...');
      await this.powersync.connect(this.supabaseConnector);
      console.log('PowerSync connected successfully');

      // Store the current user ID
      // console.log('Getting current session...');
      // const session = await this.supabaseConnector.client.auth.getSession();
      // this.lastConnectedUserId = session.data.session?.user.id;
      // console.log('Current user ID:', this.lastConnectedUserId);

      // Wait for the initial sync to complete
      // await this.powersync.waitForFirstSync();

      this.initialized = true;
      console.log('PowerSync marked as initialized');

      // Initialize attachment queues and wait for completion
      console.log('Starting attachment queues initialization...');
      await this.initializeAttachmentQueues();
      console.log('Attachment queues initialization completed');

      console.log('PowerSync initialization complete');
    } catch (error) {
      console.error('PowerSync initialization error:', error);
      this.initialized = false;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  // New method to properly initialize attachment queues
  private async initializeAttachmentQueues(): Promise<void> {
    // If already initializing, wait for existing promise
    if (this.attachmentQueueInitPromise) {
      await this.attachmentQueueInitPromise;
      return;
    }

    // If already initialized, return immediately
    if (this.attachmentQueuesInitialized) {
      return;
    }

    // Create new initialization promise
    this.attachmentQueueInitPromise = this._initializeAttachmentQueues();

    try {
      await this.attachmentQueueInitPromise;
    } finally {
      this.attachmentQueueInitPromise = null;
    }
  }

  private async _initializeAttachmentQueues(): Promise<void> {
    try {
      console.log('Initializing attachment queues...');

      // Check if bucket is configured
      if (!AppConfig.supabaseBucket) {
        console.warn(
          'No Supabase bucket configured, attachment queues will be disabled'
        );
        this.attachmentQueuesInitialized = true;
        return;
      }

      // Initialize both queues in parallel if they exist
      const initPromises: Promise<void>[] = [];

      if (this.permAttachmentQueue) {
        initPromises.push(this.permAttachmentQueue.init());
      }

      if (this.tempAttachmentQueue) {
        initPromises.push(this.tempAttachmentQueue.init());
      }

      if (initPromises.length > 0) {
        await Promise.all(initPromises);
        console.log('Attachment queues initialized successfully');
      }

      this.attachmentQueuesInitialized = true;
    } catch (error) {
      console.error('Failed to initialize attachment queues:', error);
      this.attachmentQueuesInitialized = false;
      throw error;
    }
  }

  // private lastConnectedUserId?: string;

  isInitialized() {
    return this.initialized && this.attachmentQueuesInitialized;
  }

  isPowerSyncInitialized() {
    return this.initialized;
  }

  isConnected() {
    return this.powersync.connected;
  }

  // Add method to check attachment queue readiness specifically
  areAttachmentQueuesReady(): boolean {
    return this.attachmentQueuesInitialized;
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
      // Cleanup attachment queues first
      if (this.permAttachmentQueue) {
        try {
          // Call destroy method if it exists
          (
            this.permAttachmentQueue as unknown as { destroy?: () => void }
          ).destroy?.();
        } catch (error) {
          console.warn('Error destroying permanent attachment queue:', error);
        }
      }

      if (this.tempAttachmentQueue) {
        try {
          // Call destroy method if it exists
          (
            this.tempAttachmentQueue as unknown as { destroy?: () => void }
          ).destroy?.();
        } catch (error) {
          console.warn('Error destroying temporary attachment queue:', error);
        }
      }

      // Disconnect PowerSync
      if (this.powersync.connected) {
        await this.powersync.disconnect();
      }

      this.initialized = false;
      this.attachmentQueuesInitialized = false;
      this.attachmentQueueInitPromise = null;
      // this.lastConnectedUserId = undefined;
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
