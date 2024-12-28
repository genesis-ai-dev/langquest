import '@azure/core-asynciterator-polyfill';
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";

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
import { drizzleSchema}  from '../drizzleSchema';

Logger.useDefaults();

export class System {
  kvStorage: KVStorage;
  // storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  // attachmentQueue: PhotoAttachmentQueue | undefined = undefined;
  db: any;

  constructor() {
    console.log('System constructor');
    this.kvStorage = new KVStorage();
    this.supabaseConnector = new SupabaseConnector(this);
    // this.storage = this.supabaseConnector.storage;
    this.powersync = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: 'sqlite.db',
        debugMode: true,
      }
    });

    console.log('Wrapping PowerSync with Drizzle');
    this.db = wrapPowerSyncWithDrizzle(this.powersync, {
        schema: drizzleSchema,
      }
    )
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