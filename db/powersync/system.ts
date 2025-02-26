import '@azure/core-asynciterator-polyfill';
import {
  DrizzleAppSchema,
  PowerSyncSQLiteDatabase,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';

import { PowerSyncDatabase, Schema } from '@powersync/react-native';
import React from 'react';
import { SupabaseStorageAdapter } from '../supabase/SupabaseStorageAdapter';

import Logger from 'js-logger';
import { KVStorage } from '../KVStorage';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import * as drizzleSchema from '../drizzleSchema';
import Constants from 'expo-constants';
import { AppConfig } from '../supabase/AppConfig';
import { AttachmentTable, type AttachmentRecord } from '@powersync/attachments';
import { AttachmentQueue } from './AttachmentQueue';

Logger.useDefaults();

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
const powersyncUrl = Constants.expoConfig?.extra?.powersyncUrl;

if (!supabaseUrl || !supabaseAnonKey || !powersyncUrl) {
  throw new Error('Supabase URL, Anon Key, or PowerSync URL is not defined');
}

export class System {
  kvStorage: KVStorage;
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  attachmentQueue: AttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor() {
    this.kvStorage = new KVStorage();
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;
    this.powersync = new PowerSyncDatabase({
      schema: new Schema([
        ...new DrizzleAppSchema(drizzleSchema).tables,
        new AttachmentTable()
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
      this.attachmentQueue = new AttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        db: this.db,
        // Use this to handle download errors where you can use the attachment
        // and/or the exception to decide if you want to retry the download
        onDownloadError: async (
          attachment: AttachmentRecord,
          exception: any
        ) => {
          if (exception.toString() === 'StorageApiError: Object not found') {
            return { retry: false };
          }

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
      await this.powersync.init();

      // If we're already connected, disconnect first
      // This is to ensure that we can access user-specific sync bucket records with current user credentials
      if (this.powersync.connected) {
        console.log(
          'Disconnecting existing PowerSync connection before reconnecting'
        );
        await this.powersync.disconnect();
      }

      // Connect with the current user credentials
      console.log('Connecting PowerSync with current user credentials');
      await this.powersync.connect(this.supabaseConnector);

      if (this.attachmentQueue) {
        await this.attachmentQueue.init();
      }

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
      let initialTimestamp =
        this.powersync.currentStatus?.lastSyncedAt?.getTime() || 0;
      console.log(`Current lastSyncedAt timestamp: ${initialTimestamp}`);

      const unsubscribe = this.powersync.registerListener({
        statusChanged: (status) => {
          // Check if we have a new sync completion timestamp
          const newTimestamp = status.lastSyncedAt?.getTime() || 0;

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
export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
