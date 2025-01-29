import '@azure/core-asynciterator-polyfill';
import {
  PowerSyncSQLiteDatabase,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';

import { PowerSyncDatabase } from '@powersync/react-native';
import React from 'react';
// import { SupabaseStorageAdapter } from '../storage/SupabaseStorageAdapter';

// import { type AttachmentRecord } from '@powersync/attachments';
import Logger from 'js-logger';
import { KVStorage } from '../KVStorage';
// import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { AppSchema } from './psSchema';
// import { PhotoAttachmentQueue } from './PhotoAttachmentQueue';
// import { DrizzleConfig } from 'drizzle-orm';
import * as drizzleSchema from '../drizzleSchema';
import Constants from 'expo-constants';

Logger.useDefaults();

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
const powersyncUrl = Constants.expoConfig?.extra?.powersyncUrl;

if (!supabaseUrl || !supabaseAnonKey || !powersyncUrl) {
  throw new Error('Supabase URL, Anon Key, or PowerSync URL is not defined');
}

export class System {
  kvStorage: KVStorage;
  // storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  // attachmentQueue: PhotoAttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  constructor() {
    console.log('System constructor');
    this.kvStorage = new KVStorage();
    this.supabaseConnector = new SupabaseConnector(this);
    // this.storage = this.supabaseConnector.storage;
    this.powersync = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: 'sqlite.db',
        debugMode: true
      }
    });

    console.log('Wrapping PowerSync with Drizzle');
    this.db = wrapPowerSyncWithDrizzle(this.powersync, {
      schema: drizzleSchema
    });
  }

  private initialized = false;
  private connecting = false;

  async init() {
    if (this.initialized || this.connecting) {
      return;
    }

    try {
      this.connecting = true;
      await this.powersync.init();
      await this.powersync.connect(this.supabaseConnector);
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
