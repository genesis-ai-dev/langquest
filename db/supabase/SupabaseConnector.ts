// Import from native SDK - will be empty on web
import type {
  AbstractPowerSyncDatabase as AbstractPowerSyncDatabaseNative,
  CrudEntry as CrudEntryNative,
  PowerSyncBackendConnector as PowerSyncBackendConnectorNative
} from '@powersync/react-native';
import { UpdateType as UpdateTypeNative } from '@powersync/react-native';

// Import from web SDK - will be empty on native
import { UpdateType as UpdateTypeWeb } from '@powersync/web';

// Use the correct types based on platform

type AbstractPowerSyncDatabase = AbstractPowerSyncDatabaseNative;

type CrudEntry = CrudEntryNative;

type PowerSyncBackendConnector = PowerSyncBackendConnectorNative;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const UpdateType = UpdateTypeNative || UpdateTypeWeb;

import type { Profile } from '@/database_services/profileService';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PostgrestSingleResponse,
  Session,
  SupabaseClient
} from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzleSchema';
import { profile } from '../drizzleSchema';
import type { System } from '../powersync/system';
import { AppConfig } from './AppConfig';

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

export class SupabaseConnector implements PowerSyncBackendConnector {
  private compositeKeyTables: CompositeKeyConfig[] = [];
  client: SupabaseClient;
  private currentSession: Session | null = null;

  constructor(protected system: System) {
    console.log('Creating Supabase client (supabaseConnector constructor');
    if (!AppConfig.supabaseUrl || !AppConfig.supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key is not defined');
    }

    if (!AppConfig.powersyncUrl) {
      throw new Error('PowerSync URL is not defined');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.client = createClient(
      AppConfig.supabaseUrl,
      AppConfig.supabaseAnonKey,
      {
        auth: {
          storage: AsyncStorage
        }
      }
    );

    // console.log('Supabase client created: ', this.client);
    this.client.auth.onAuthStateChange((event, session) => {
      console.log('------------------------------------');
      console.log('Auth state changed:', event);
      console.log('User email:', session?.user.email);
      console.log('User ID:', session?.user.id);
      console.log('------------------------------------');
    });
    // console.log('Supabase client created: ', this.client);

    // Initialize composite key tables
    this.initCompositeKeyTables();
  }

  private initCompositeKeyTables() {
    console.log('Initializing composite key tables');

    const tables = Object.entries(schema)
      .filter(
        ([_, value]) =>
          typeof value === 'object' &&
          Symbol.for('drizzle:IsDrizzleTable') in value
      )
      // eslint-disable-next-line
      .map(([_, table]: [string, any]) => table);

    // Let's examine the full structure of one composite key table
    // eslint-disable-next-line
    const assetDownload = tables.find(
      // eslint-disable-next-line
      (t) => t[Symbol.for('drizzle:Name')] === 'asset_download'
    );
    if (assetDownload) {
      console.log('Asset Download table full structure:', {
        // eslint-disable-next-line
        name: assetDownload[Symbol.for('drizzle:Name')],
        allSymbols: Object.getOwnPropertySymbols(assetDownload),
        // eslint-disable-next-line
        allProperties: Object.keys(assetDownload),
        // eslint-disable-next-line
        config: assetDownload.config,
        // eslint-disable-next-line
        extraConfig: assetDownload[Symbol.for('drizzle:ExtraConfigBuilder')]
      });
    }

    // For now, let's hardcode the composite key tables since we know them from the schema
    this.compositeKeyTables = [
      { table: 'quest_tag_link', keys: ['quest_id', 'tag_id'] },
      { table: 'asset_tag_link', keys: ['asset_id', 'tag_id'] },
      { table: 'quest_asset_link', keys: ['quest_id', 'asset_id'] },
      { table: 'blocked_users', keys: ['blocker_id', 'blocked_id'] },
      { table: 'profile_project_link', keys: ['profile_id', 'project_id'] },
      { table: 'project_language_link', keys: ['project_id', 'language_id'] }
    ];

    console.log('Final composite key tables:', this.compositeKeyTables);
  }

  async isAnonymousSession() {
    const {
      data: { session }
    } = await this.client.auth.getSession();
    console.log('Session:', session);
    return session?.user.is_anonymous === true;
  }

  async getUserProfile(userId?: string) {
    let user = userId;
    if (!userId) {
      const session = await this.client.auth.getSession();
      user = session.data.session?.user.id;
    }
    if (!user) return null;

    // Check if system is initialized before trying to access local DB
    if (this.system.isPowerSyncInitialized()) {
      // Check local database for profile
      const localProfile = (
        await this.system.db.select().from(profile).where(eq(profile.id, user))
      )[0] as Profile | null;

      if (localProfile) {
        console.log(
          '✅ [SupabaseConnector] Found local profile for user:',
          user
        );
        return localProfile;
      }
    } else {
      console.log(
        '⚠️ [SupabaseConnector] System not initialized, skipping local DB check'
      );
    }

    // If no local profile, try to fetch from Supabase
    console.log(
      '🔄 [SupabaseConnector] No local profile, attempting online fetch for user:',
      user
    );

    try {
      const { data: userData, error: userError } = await this.client
        .from('profile')
        .select('*')
        .eq('id', user)
        .single<Profile>();

      if (userError) {
        console.error(
          '❌ [SupabaseConnector] Error fetching user profile from Supabase:',
          userError
        );

        // For offline scenarios, create a minimal profile object to prevent logout
        // This ensures the user stays logged in even when profile fetch fails
        console.log(
          '🔄 [SupabaseConnector] Creating minimal profile for offline user:',
          user
        );
        return {
          id: user,
          email: null,
          username: null,
          password: null,
          avatar: null,
          ui_language_id: null,
          terms_accepted: false,
          terms_accepted_at: null,
          active: true,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        } as Profile;
      }

      console.log(
        '✅ [SupabaseConnector] Successfully fetched profile from Supabase for user:',
        user
      );
      return userData;
    } catch (error) {
      console.error(
        '❌ [SupabaseConnector] Network error while fetching profile:',
        error
      );

      // For network errors (offline), create a minimal profile to prevent logout
      console.log(
        '🔄 [SupabaseConnector] Creating minimal profile due to network error for user:',
        user
      );
      return {
        id: user,
        email: null,
        username: null,
        password: null,
        avatar: null,
        ui_language_id: null,
        terms_accepted: false,
        terms_accepted_at: null,
        active: true,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      } as Profile;
    }
  }

  async login(username: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: username,
      password: password
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    return data;
  }

  async signOut() {
    await this.client.auth.signOut();
    const supabaseAuthKey = await getSupabaseAuthKey();
    if (supabaseAuthKey) await AsyncStorage.removeItem(supabaseAuthKey);
  }

  async fetchCredentials() {
    // Use stored session if available, otherwise fetch fresh
    let session = this.currentSession;

    if (!session) {
      console.log('[SupabaseConnector] No stored session, fetching fresh...');
      const {
        data: { session: freshSession },
        error
      } = await this.client.auth.getSession();

      if (!freshSession || error) {
        throw new Error(
          `Could not fetch Supabase credentials: ${JSON.stringify(error)}`
        );
      }

      session = freshSession;
      this.currentSession = session;
    }

    console.log('[SupabaseConnector] Using session for user:', session.user.id);
    console.debug('session expires at', session.expires_at);

    return {
      endpoint: AppConfig.powersyncUrl ?? '',
      token: session.access_token,
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
        let result: PostgrestSingleResponse<unknown> | null = null;
        let record;

        // Find composite key config for this table
        const compositeConfig = this.compositeKeyTables.find(
          (c) => c.table === op.table
        );
        const isCompositeTable = !!compositeConfig;

        let compositeKeys = {};
        if (isCompositeTable && op.id) {
          const [firstId, secondId] = op.id.split('_');
          compositeKeys = {
            [compositeConfig.keys[0]!]: firstId,
            [compositeConfig.keys[1]!]: secondId
          };
        }

        if (
          op.table === 'download' &&
          typeof op.opData?.record_key === 'string'
        ) {
          op.opData.record_key = JSON.parse(op.opData.record_key);
        }

        const opData =
          isCompositeTable && op.opData
            ? Object.fromEntries(
                Object.entries(op.opData).filter(([key]) => key !== 'id')
              )
            : op.opData;

        // Handle array fields for all operations
        const processArrayFields = (
          data: Record<string, unknown> | null | undefined
        ): Record<string, unknown> | null | undefined => {
          if (!data) return data;

          const processed = { ...data };

          // List of known array fields in the schema
          const arrayFields = [
            'download_profiles',
            'images', // in asset table
            'audio',
            'asset_ids',
            'translation_ids',
            'vote_ids',
            'tag_ids',
            'language_ids', // closure tables
            'quest_ids',
            'quest_asset_link_ids',
            'asset_content_link_ids',
            'quest_tag_link_ids',
            'asset_tag_link_ids'
          ];

          // Process each array field
          for (const field of arrayFields) {
            if (field in processed && typeof processed[field] === 'string') {
              try {
                let parsed: unknown = processed[field];

                // Handle double-encoded strings (string containing escaped JSON)
                if (
                  typeof parsed === 'string' &&
                  parsed.startsWith('"') &&
                  parsed.endsWith('"')
                ) {
                  parsed = JSON.parse(parsed);
                }

                // Now parse the actual array
                processed[field] =
                  typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                console.log(`Parsed ${field}:`, processed[field]);
              } catch (e) {
                console.warn(`Failed to parse ${field} as JSON:`, e);
                console.warn('Raw value:', processed[field]);
              }
            }
          }

          return processed;
        };

        switch (op.op) {
          case UpdateType.PUT: {
            record = isCompositeTable
              ? { ...compositeKeys, ...opData }
              : { ...opData, id: op.id };

            // Process array fields
            record = processArrayFields(record);

            // Log the record for debugging
            if (op.table === 'vote') {
              console.log(
                'Vote record after processing:',
                JSON.stringify(record, null, 2)
              );
            }

            console.log('Record:', record);

            result = await table.upsert(record);
            break;
          }

          case UpdateType.PATCH: {
            // Process array fields for PATCH operations
            const patchData = processArrayFields(opData);

            if (isCompositeTable && patchData) {
              result = await table.update(patchData).match(compositeKeys);
            } else {
              result = await table.update(patchData).eq('id', op.id);
            }
            break;
          }

          case UpdateType.DELETE:
            if (isCompositeTable) {
              result = await table.delete().match(compositeKeys);
            } else {
              result = await table.delete().eq('id', op.id);
            }
            console.log('delete result', result);
            break;
        }

        if (result.error) {
          console.debug('Upload data', result.data, opData);
          result.error.message = `Could not ${op.op} data to Supabase error: ${JSON.stringify(
            result
          )}`;
          result.error.stack = undefined;
          throw result.error;
        } else {
          console.log('Uploaded successfully:', opData);
        }
      }

      await transaction.complete();
    } catch (ex) {
      const error = ex as Error & { code?: string };
      console.error(`Upload data exception: ${error.message}`);
      // Note: PostHog integration moved to avoid circular dependency
      if (
        typeof error.code == 'string' &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code!))
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
        // await transaction.complete();
      } else {
        // Error may be retryable - e.g. network error or temporary server error.
        // Throwing an error here causes this call to be retried after a delay.
        throw ex;
      }
    }
  }

  updateSession(session: Session | null) {
    console.log(
      '[SupabaseConnector] Updating session:',
      session ? 'Session present' : 'Session cleared'
    );
    this.currentSession = session;
  }
}
