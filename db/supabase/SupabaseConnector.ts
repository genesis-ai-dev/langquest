import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType
} from '@powersync/react-native';

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AppConfig } from './AppConfig';
import { SupabaseStorageAdapter } from './SupabaseStorageAdapter';
import { System } from '../powersync/system';

import * as schema from '../drizzleSchema';

// const allTables = Object.values(schema).filter(
//   (value) =>
//     'name' in value &&
//     'columns' in value &&
//     'dialect' in value &&
//     value.dialect === 'sqlite'
// ) as any[];

// const compositeKeyTables = allTables
//   .filter((table) => {
//     const pk = table.constraints.primaryKey;
//     console.log('Primary key for table', table.name, ':', pk);
//     return pk && pk.columns.length > 1;
//   })
//   .map((table) => {
//     const pk = table.constraints.primaryKey;
//     const result = {
//       table: table.name,
//       keys: pk.columns.map((col: any) => col.name)
//     };
//     console.log(
//       `Found composite key table: ${result.table} with keys: ${result.keys.join(', ')}`
//     );
//     return result;
//   });

// const COMPOSITE_KEY_TABLES: CompositeKeyConfig[] = compositeKeyTables;

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [
  // Class 22 — Data Exception
  // Examples include data type mismatch.
  new RegExp('^22...$'),
  // Class 23 — Integrity Constraint Violation.
  // Examples include NOT NULL, FOREIGN KEY and UNIQUE violations.
  new RegExp('^23...$'),
  // INSUFFICIENT PRIVILEGE - typically a row-level security violation
  new RegExp('^42501$')
];

interface CompositeKeyConfig {
  table: string;
  keys: string[];
}

// const COMPOSITE_KEY_TABLES: CompositeKeyConfig[] = [
//   {
//     table: 'project_download',
//     keys: ['profile_id', 'project_id']
//   },
//   {
//     table: 'quest_download',
//     keys: ['profile_id', 'quest_id']
//   },
//   {
//     table: 'asset_download',
//     keys: ['profile_id', 'asset_id']
//   },
//   {
//     table: 'quest_tag_link',
//     keys: ['quest_id', 'tag_id']
//   },
//   {
//     table: 'asset_tag_link',
//     keys: ['asset_id', 'tag_id']
//   },
//   {
//     table: 'quest_asset_link',
//     keys: ['quest_id', 'asset_id']
//   }
// ];

export class SupabaseConnector implements PowerSyncBackendConnector {
  private compositeKeyTables: CompositeKeyConfig[] = [];
  client: SupabaseClient;
  storage: SupabaseStorageAdapter;

  constructor(protected system: System) {
    console.log('Creating Supabase client (supabaseConnector constructor');
    if (!AppConfig.supabaseUrl || !AppConfig.supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key is not defined');
    }

    this.client = createClient(
      AppConfig.supabaseUrl,
      AppConfig.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          storage: this.system.kvStorage,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    );
    this.storage = new SupabaseStorageAdapter({ client: this.client });

    console.log('Supabase client created: ', this.client);
    this.client.auth.onAuthStateChange((event, session) => {
      console.log('------------------------------------');
      console.log('Auth state changed:', event);
      console.log('User email:', session?.user?.email);
      console.log('User ID:', session?.user?.id);
      console.log('------------------------------------');
    });
    console.log('Supabase client created: ', this.client);

    // Initialize composite key tables
    this.initCompositeKeyTables();
  }

  private initCompositeKeyTables() {
    console.log('Initializing composite key tables');

    const tables = Object.entries(schema)
      .filter(
        ([_, value]) =>
          value &&
          typeof value === 'object' &&
          Symbol.for('drizzle:IsDrizzleTable') in value
      )
      .map(([_, table]: [string, any]) => table);

    // Let's examine the full structure of one composite key table
    const assetDownload = tables.find(
      (t) => t[Symbol.for('drizzle:Name')] === 'asset_download'
    );
    if (assetDownload) {
      console.log('Asset Download table full structure:', {
        name: assetDownload[Symbol.for('drizzle:Name')],
        allSymbols: Object.getOwnPropertySymbols(assetDownload),
        allProperties: Object.keys(assetDownload),
        config: assetDownload.config,
        extraConfig: assetDownload[Symbol.for('drizzle:ExtraConfigBuilder')]
      });
    }

    // For now, let's hardcode the composite key tables since we know them from the schema
    this.compositeKeyTables = [
      { table: 'quest_tag_link', keys: ['quest_id', 'tag_id'] },
      { table: 'asset_tag_link', keys: ['asset_id', 'tag_id'] },
      { table: 'quest_asset_link', keys: ['quest_id', 'asset_id'] },
      { table: 'project_download', keys: ['profile_id', 'project_id'] },
      { table: 'quest_download', keys: ['profile_id', 'quest_id'] },
      { table: 'asset_download', keys: ['profile_id', 'asset_id'] }
    ];

    console.log('Final composite key tables:', this.compositeKeyTables);
  }

  async isAnonymousSession() {
    const {
      data: { session }
    } = await this.client.auth.getSession();
    console.log('Session:', session);
    return session?.user?.is_anonymous === true;
  }

  async login(username: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: username,
      password: password
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async signOut() {
    await this.client.auth.signOut();
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) throw error;
    return data;
  }

  async fetchCredentials() {
    const {
      data: { session },
      error
    } = await this.client.auth.getSession();

    if (!session || error) {
      throw new Error(`Could not fetch Supabase credentials: ${error}`);
    }

    console.debug('session expires at', session.expires_at);

    return {
      endpoint: AppConfig.powersyncUrl ?? '',
      token: session.access_token ?? '',
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
      userID: session.user.id
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: CrudEntry | null = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = this.client.from(op.table);
        let result: any = null;

        // Find composite key config for this table
        const compositeConfig = this.compositeKeyTables.find(
          (c) => c.table === op.table
        );
        const isCompositeTable = !!compositeConfig;

        let compositeKeys = {};
        if (isCompositeTable && op.id) {
          const [firstId, secondId] = op.id.split('_');
          compositeKeys = {
            [compositeConfig.keys[0]]: firstId,
            [compositeConfig.keys[1]]: secondId
          };
        }

        if (op.table === 'asset_download') {
          console.log('Operation:', {
            table: op.table,
            op: op.op,
            id: op.id,
            opData: op.opData,
            clientId: op.clientId
          });
        }

        const opData =
          isCompositeTable && op.opData
            ? Object.fromEntries(
                Object.entries(op.opData).filter(([key]) => key !== 'id')
              )
            : op.opData;

        switch (op.op) {
          case UpdateType.PUT:
            const record = isCompositeTable
              ? { ...compositeKeys, ...opData }
              : { ...opData, id: op.id };
            result = await table.upsert(record);
            break;

          case UpdateType.PATCH:
            if (isCompositeTable && op.opData) {
              result = await table.update(opData).match(compositeKeys);
            } else {
              result = await table.update(opData).eq('id', op.id);
            }
            break;

          case UpdateType.DELETE:
            if (isCompositeTable) {
              result = await table.delete().match(compositeKeys);
            } else {
              result = await table.delete().eq('id', op.id);
            }
            break;
        }

        if (result.error) {
          console.error(result.error);
          result.error.message = `Could not ${op.op} data to Supabase error: ${JSON.stringify(result)}`;
          throw result.error;
        }
      }

      await transaction.complete();
    } catch (ex: any) {
      console.debug(ex);
      if (
        typeof ex.code == 'string' &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(ex.code))
      ) {
        /**
         * Instead of blocking the queue with these errors,
         * discard the (rest of the) transaction.
         *
         * Note that these errors typically indicate a bug in the application.
         * If protecting against data loss is important, save the failing records
         * elsewhere instead of discarding, and/or notify the user.
         */
        console.error('Data upload error - discarding:', lastOp, ex);
        await transaction.complete();
      } else {
        // Error may be retryable - e.g. network error or temporary server error.
        // Throwing an error here causes this call to be retried after a delay.
        throw ex;
      }
    }
  }
}
