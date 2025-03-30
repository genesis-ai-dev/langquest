import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType
} from '@powersync/react-native';

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { SupabaseStorageAdapter } from './SupabaseStorageAdapter';
import { System } from '../powersync/system';
import { AppConfig } from './AppConfig';
import { Profile, profileService } from '@/database_services/profileService';
import { eq } from 'drizzle-orm';
import { profile } from '../drizzleSchema';
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

export class SupabaseConnector implements PowerSyncBackendConnector {
  client: SupabaseClient;
  storage: SupabaseStorageAdapter;

  constructor(protected system: System) {
    console.log('Creating Supabase client (supabaseConnector constructor');
    if (!AppConfig.supabaseUrl || !AppConfig.supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key is not defined');
    }

    if (!AppConfig.powersyncUrl) {
      throw new Error('PowerSync URL is not defined');
    }

    this.client = createClient(
      AppConfig.supabaseUrl,
      AppConfig.supabaseAnonKey,
      {
        auth: {
          storage: this.system.kvStorage
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
  }

  async isAnonymousSession() {
    const {
      data: { session }
    } = await this.client.auth.getSession();
    console.log('Session:', session);
    return session?.user?.is_anonymous === true;
  }

  async getUserProfile(userId?: string): Promise<Profile | null> {
    let user = userId;
    if (!userId) {
      const session = await this.client.auth.getSession();
      user = session.data.session?.user.id;
    }
    if (!user) return null;

    // Check local database for profile
    const localProfile = (
      await this.system.db.select().from(profile).where(eq(profile.id, user))
    )[0];

    return localProfile;
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

    if (!transaction) {
      return;
    }

    let lastOp: CrudEntry | null = null;
    try {
      // Note: If transactional consistency is important, use database functions
      // or edge functions to process the entire transaction in a single call.
      for (const op of transaction.crud) {
        lastOp = op;
        const table = this.client.from(op.table);
        let result: any = null;
        switch (op.op) {
          case UpdateType.PUT:
            // eslint-disable-next-line no-case-declarations
            const record = { ...op.opData, id: op.id };
            result = await table.upsert(record);
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
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
