import '@azure/core-asynciterator-polyfill';
import 'react-native-url-polyfill/auto';
import {
  DrizzleAppSchema,
  PowerSyncSQLiteDatabase,
  toPowerSyncTable,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';

import { PowerSyncDatabase, Schema, Table } from '@powersync/react-native';
import React from 'react';
import { SupabaseStorageAdapter } from '../supabase/SupabaseStorageAdapter';

import { AttachmentTable, type AttachmentRecord } from '@powersync/attachments';
import Logger from 'js-logger';
import * as drizzleSchema from '../drizzleSchema';
import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { AttachmentQueue } from './AttachmentQueue';
Logger.useDefaults();

export class System {
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  attachmentQueue: AttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor() {
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
          console.log('onDownloadError', attachment, exception);
          if (exception.toString() === 'StorageApiError: Object not found') {
            return { retry: false };
          }

          return { retry: true };
        },
        onUploadError: async (attachment: AttachmentRecord, exception: any) => {
          console.log('onUploadError', attachment, exception);
          return { retry: true };
        }
      });
    }
  }

  private initialized = false;
  private connecting = false;

  async init() {
    if (this.initialized || this.connecting) {
      console.log('System already initialized or connecting');
      return;
    }

    try {
      this.connecting = true;
      await this.powersync.init();
      await this.powersync.connect(this.supabaseConnector);

      // if (this.attachmentQueue) {
      //   await this.attachmentQueue.init();
      // }

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
}

export const system = new System();
export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
