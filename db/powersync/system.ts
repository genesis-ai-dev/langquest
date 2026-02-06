'use no memo';
import '@azure/core-asynciterator-polyfill';
import type {
  DrizzleTableWithPowerSyncOptions,
  PowerSyncSQLiteDatabase
} from '@powersync/drizzle-driver';
import {
  DrizzleAppSchema,
  wrapPowerSyncWithDrizzle
} from '@powersync/drizzle-driver';
import type { Table } from 'drizzle-orm';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import 'react-native-url-polyfill/auto';
import uuid from 'react-native-uuid';

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

import { SupabaseStorageAdapter } from '../supabase/SupabaseStorageAdapter';

import type { AttachmentRecord } from '@powersync/attachments';
import { AttachmentTable } from '@powersync/attachments';
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import Logger from 'js-logger';
import * as drizzleSchema from '../drizzleSchema';
import * as drizzleSchemaLocal from '../drizzleSchemaLocal';
import { AppConfig } from '../supabase/AppConfig';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { AbstractSharedAttachmentQueue } from './AbstractSharedAttachmentQueue';
import { PermAttachmentQueue } from './PermAttachmentQueue';
import { ATTACHMENT_QUEUE_LIMITS } from './constants';
import { getDefaultOpMetadata } from './opMetadata';

import { useLocalStore } from '@/store/localStore';
import { resetDatabase } from '@/utils/dbUtils';
import type { InferInsertModel } from 'drizzle-orm';

type InsertQuest = InferInsertModel<typeof drizzleSchema.quest>;
type InsertAsset = InferInsertModel<typeof drizzleSchema.asset>;
type InsertQuestAssetLink = InferInsertModel<
  typeof drizzleSchema.quest_asset_link
>;
type InsertAssetContentLink = InferInsertModel<
  typeof drizzleSchema.asset_content_link
>;
type InsertVote = InferInsertModel<typeof drizzleSchema.vote>;
// Use the correct imports based on platform
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Column = ColumnNative || ColumnWeb;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const ColumnType = ColumnTypeNative || ColumnTypeWeb;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const Schema = SchemaNative || SchemaWeb;
// const SyncClientImplementation =

// SyncClientImplementationNative || SyncClientImplementationWeb;

Logger.useDefaults();

// English languoid ID constant (matches seed data)
const ENGLISH_LANGUOID_ID = 'bd6027e5-b122-43b9-ba0a-4f5d5a25f1dd';

export class System {
  private static instance: System | null = null;

  factory: WASQLiteOpenFactory | OPSqliteOpenFactory;
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabaseNative | PowerSyncDatabaseWeb;
  permAttachmentQueue: PermAttachmentQueue | undefined = undefined;
  // tempAttachmentQueue: TempAttachmentQueue | undefined = undefined;
  db: PowerSyncSQLiteDatabase<typeof drizzleSchema>;

  // Add tracking for attachment queue initialization
  private attachmentQueuesInitialized = false;
  private attachmentQueueInitPromise: Promise<void> | null = null;

  // Migration state
  public migrationNeeded = false;
  private migratingNow = false;

  constructor() {
    // Prevent multiple instantiation
    if (System.instance) {
      throw new Error(
        'System instance already exists. Use System.getInstance() instead.'
      );
    }
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = new SupabaseStorageAdapter({
      client: this.supabaseConnector.client
    });

    const drizzleSchemaWithOptions = {
      ...Object.entries(drizzleSchema).reduce(
        (acc, [key, table]) => {
          if (is(table, SQLiteTable)) {
            // const tableWithoutSource = {
            //   ...table
            // };

            // delete (tableWithoutSource as unknown as { source?: unknown })
            //   .source;

            // // Delete drizzle symbols that contain source
            // const drizzleSymbols =
            //   Object.getOwnPropertySymbols(tableWithoutSource);
            // for (const symbol of drizzleSymbols) {
            //   const symbolStr = symbol.toString();
            //   if (
            //     symbolStr.includes('drizzle:Columns') ||
            //     symbolStr.includes('drizzle:ExtraConfigColumns')
            //   ) {
            //     const symbolValue = (
            //       tableWithoutSource as Record<symbol, Record<string, unknown>>
            //     )[symbol];
            //     if (
            //       symbolValue &&
            //       typeof symbolValue === 'object' &&
            //       'source' in symbolValue
            //     ) {
            //       delete symbolValue.source;
            //     }
            //   }
            // }

            acc[key] = {
              tableDefinition: table,
              options: {
                viewName: `${key}_synced`,
                trackMetadata: true,
                ignoreEmptyUpdates: true
              }
            } as DrizzleTableWithPowerSyncOptions;
            return acc;
          }
          return acc;
        },
        {} as Record<string, DrizzleTableWithPowerSyncOptions>
      ),
      ...Object.entries(drizzleSchemaLocal).reduce(
        (acc, [key, localTable]) => {
          if (is(localTable, SQLiteTable)) {
            // const localTableWithoutSource = {
            //   ...localTable
            // };
            // delete (localTableWithoutSource as unknown as { source?: unknown })
            //   .source;

            // // Delete drizzle symbols that contain source
            // const drizzleSymbols = Object.getOwnPropertySymbols(
            //   localTableWithoutSource
            // );
            // for (const symbol of drizzleSymbols) {
            //   const symbolStr = symbol.toString();
            //   if (
            //     symbolStr.includes('drizzle:Columns') ||
            //     symbolStr.includes('drizzle:ExtraConfigColumns')
            //   ) {
            //     const symbolValue = (
            //       localTableWithoutSource as Record<
            //         symbol,
            //         Record<string, unknown>
            //       >
            //     )[symbol];
            //     if (
            //       symbolValue &&
            //       typeof symbolValue === 'object' &&
            //       'source' in symbolValue
            //     ) {
            //       delete symbolValue.source;
            //     }
            //   }
            // }

            acc[key] = {
              tableDefinition: localTable,
              options: {
                localOnly: true,
                ignoreEmptyUpdates: true
              }
            } as DrizzleTableWithPowerSyncOptions;
          }
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

    Logger.setLevel(Logger.DEBUG);
    // Check if we're on native or web platform
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (PowerSyncDatabaseNative) {
      this.factory = new OPSqliteOpenFactory({
        dbFilename: 'sqlite.db',
        debugMode: true
      });
      this.powersync = new PowerSyncDatabaseNative({
        schema,
        database: this.factory,
        logger: Logger
      });
    } else {
      this.factory = new WASQLiteOpenFactory({
        dbFilename: 'sqlite.db',
        worker: '/@powersync/worker/WASQLiteDB.umd.js',
        debugMode: true,
        logger: Logger
      });
      this.powersync = new PowerSyncDatabaseWeb({
        schema,
        database: this.factory,
        sync: {
          worker: '/@powersync/worker/SharedSyncImplementation.umd.js'
        },
        logger: Logger
      });
    }

    const rawDb = wrapPowerSyncWithDrizzle(this.powersync, {
      schema: drizzleSchema
    });

    function stamp(val: unknown) {
      const tag = getDefaultOpMetadata();
      if (Array.isArray(val)) {
        return val.map((v) =>
          v && typeof v === 'object' && (v as any)._metadata === undefined
            ? { ...(v as any), _metadata: tag }
            : v
        );
      }
      if (
        val &&
        typeof val === 'object' &&
        (val as any)._metadata === undefined
      ) {
        return { ...(val as any), _metadata: tag };
      }
      return val;
    }

    // Capture PowerSync instance for migrations
    const powersyncInstance = this.powersync;

    /**
     * Wrap insert() to stamp _metadata on values
     */
    function wrapInsert(target: any) {
      return (table: any) => {
        const builder = target.insert(table);
        return new Proxy(builder, {
          get(b, m) {
            if (m === 'values') {
              return (v: any) => b.values(stamp(v));
            }
            return Reflect.get(b, m);
          }
        });
      };
    }

    /**
     * Wrap update() to stamp _metadata on set values
     */
    function wrapUpdate(target: any) {
      return (table: any) => {
        const builder = target.update(table);
        return new Proxy(builder, {
          get(b, m) {
            if (m === 'set') {
              return (v: any) => b.set(stamp(v));
            }
            return Reflect.get(b, m);
          }
        });
      };
    }

    /**
     * Create a proxy that wraps insert/update to stamp _metadata
     * Used for both the main db and transaction contexts
     */
    function createMetadataProxy(
      target: any,
      extraProps?: Record<string, any>
    ) {
      return new Proxy(target, {
        get(t: any, prop: any, receiver: any) {
          // Check extra props first (e.g., rawPowerSync)
          if (extraProps && prop in extraProps) {
            return extraProps[prop];
          }
          if (prop === 'insert') {
            return wrapInsert(t);
          }
          if (prop === 'update') {
            return wrapUpdate(t);
          }
          return Reflect.get(t, prop, receiver);
        }
      });
    }

    /**
     * Wrap transaction() to also wrap the transaction context (tx)
     * This ensures _metadata stamping works inside transactions
     */
    function wrapTransaction(target: any) {
      const originalTransaction = target.transaction.bind(target);
      return async <T>(
        callback: (tx: any) => Promise<T>,
        config?: any
      ): Promise<T> => {
        return originalTransaction(async (tx: any) => {
          // Wrap the transaction context with the same metadata stamping
          const txWithMetadata = createMetadataProxy(tx);
          return callback(txWithMetadata);
        }, config);
      };
    }

    const dbWithMetadata = new Proxy(rawDb as any, {
      get(target: any, prop: any, receiver: any) {
        // Expose raw PowerSync for migrations that need to alter tables
        if (prop === 'rawPowerSync') {
          return powersyncInstance;
        }
        if (prop === 'insert') {
          return wrapInsert(target);
        }
        if (prop === 'update') {
          return wrapUpdate(target);
        }
        if (prop === 'transaction') {
          return wrapTransaction(target);
        }
        return Reflect.get(target, prop, receiver);
      }
    }) as typeof rawDb;

    this.db = dbWithMetadata;

    if (AppConfig.supabaseBucket) {
      this.permAttachmentQueue = new PermAttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        db: this.db,
        supabaseConnector: this.supabaseConnector,
        attachmentDirectoryName: AbstractSharedAttachmentQueue.SHARED_DIRECTORY,
        cacheLimit: ATTACHMENT_QUEUE_LIMITS.PERMANENT,
        // eslint-disable-next-line
        onDownloadError: async (
          attachment: AttachmentRecord,
          exception: { toString: () => string; status?: number }
        ) => {
          // Don't retry corrupted attachments with blob URLs
          if (
            attachment.id?.includes('blob:') ||
            attachment.local_uri?.includes('blob:') ||
            attachment.filename?.includes('blob:')
          ) {
            console.error(
              '[PermAttachmentQueue] Corrupted attachment with blob URL detected - not retrying:',
              attachment.id
            );
            return { retry: false };
          }

          if (
            exception.toString() === 'StorageApiError: Object not found' ||
            exception.status === 400 ||
            exception.toString().includes('status":400')
          ) {
            return { retry: false };
          }

          console.log(
            '[PermAttachmentQueue] onDownloadError',
            attachment,
            exception
          );
          return { retry: true };
        },
        // eslint-disable-next-line
        onUploadError: async (
          _attachment: AttachmentRecord,
          exception: { toString: () => string }
        ) => {
          // Don't retry corrupted attachments with blob URLs
          if (
            _attachment.id?.includes('blob:') ||
            _attachment.local_uri?.includes('blob:') ||
            _attachment.filename?.includes('blob:')
          ) {
            console.error(
              '[PermAttachmentQueue] Corrupted attachment with blob URL detected - not retrying:',
              _attachment.id
            );
            return { retry: false };
          }

          if (
            exception.toString() ===
            'StorageApiError: The resource already exists'
          ) {
            return { retry: false };
          }

          console.log(
            '[PermAttachmentQueue] onUploadError',
            JSON.stringify(_attachment, null, 2),
            exception.toString()
          );
          return { retry: true };
        }
      });

      // this.tempAttachmentQueue = new TempAttachmentQueue({
      //   powersync: this.powersync,
      //   storage: this.storage,
      //   db: this.db,
      //   attachmentDirectoryName: AbstractSharedAttachmentQueue.SHARED_DIRECTORY,
      //   cacheLimit: ATTACHMENT_QUEUE_LIMITS.TEMPORARY,
      //   // eslint-disable-next-line
      //   onDownloadError: async (
      //     attachment: AttachmentRecord,
      //     exception: { toString: () => string; status?: number }
      //   ) => {
      //     console.log(
      //       'TempAttachmentQueue onDownloadError',
      //       attachment,
      //       exception
      //     );
      //     if (
      //       exception.toString() === 'StorageApiError: Object not found' ||
      //       exception.status === 400 ||
      //       exception.toString().includes('status":400')
      //     ) {
      //       return { retry: false };
      //     }

      //     return { retry: true };
      //   },
      //   // eslint-disable-next-line
      //   onUploadError: async (
      //     _attachment: AttachmentRecord,
      //     _exception: unknown
      //   ) => {
      //     return { retry: true };
      //   }
      // });
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

        // Create union views FIRST - they expose _metadata column from Drizzle schema
        // This allows migrations to query and update _metadata through the views
        console.log('[System] Creating union views...');
        await this.createUnionViews();

        // CRITICAL: Check server schema version FIRST
        // This ensures client and server schemas are compatible before proceeding
        console.log('[System] Checking server schema version...');
        const { checkAppUpgradeNeeded } = await import(
          '../schemaVersionService'
        );
        await checkAppUpgradeNeeded(this.db, this.supabaseConnector.client);
        console.log('[System] ✓ Server schema version is compatible');

        // CRITICAL: Check if migrations are needed AFTER creating union views
        // Now we can query _metadata through the views (will be NULL for old records)
        console.log('[System] Checking for schema migrations...');

        // TEMPORARY: Reset metadata for testing migration
        // TODO: REMOVE THIS AFTER TESTING
        // console.log('[System] ⚠️  TESTING: Resetting metadata to 1.0 to force migration...');
        // const { resetMetadataVersionForTesting } = await import('../migrations/utils');
        // await resetMetadataVersionForTesting(this.db, '1.0');
        // console.log('[System] ✓ Metadata reset complete');

        const { checkNeedsMigration, MigrationNeededError } = await import(
          '../migrations/index'
        );
        const { APP_SCHEMA_VERSION } = await import('../drizzleSchema');

        // Use Drizzle-wrapped db to query through views (not raw PowerSync)
        const needsMigration = await checkNeedsMigration(
          this.db,
          APP_SCHEMA_VERSION
        );

        if (needsMigration) {
          console.log(
            '[System] ⚠️  Migration needed - blocking initialization'
          );
          this.migrationNeeded = true;
          // Throw specific error to signal UI needs to show migration screen
          throw new MigrationNeededError('outdated', APP_SCHEMA_VERSION);
        }

        console.log('[System] ✓ Schema is up to date');
      }

      // OFFLINE-FIRST FIX: Mark system as initialized and ready BEFORE connect()
      // PowerSync is designed for offline-first - the local SQLite database is fully
      // functional after powersync.init() completes. connect() handles sync in the
      // background with automatic retries, so we don't need to block on it.
      this.initialized = true;
      console.log('[System] PowerSync local database initialized');

      // Mark system ready so the app can render with local data immediately
      useLocalStore.getState().setSystemReady(true);
      console.log('[System] System marked as ready (offline-first)');

      // Start sync and attachment queues in background (non-blocking)
      // This prevents infinite spinner when offline with expired JWT
      this.connectAndInitializeInBackground();

      console.log(
        '[System] PowerSync initialization complete (sync running in background)'
      );
    } catch (error) {
      console.error('PowerSync initialization error:', error);
      this.initialized = false;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Starts PowerSync sync and attachment queue initialization in the background.
   * This is non-blocking to support offline-first usage - the app can render
   * immediately with local data while sync establishes in the background.
   *
   * PowerSync handles reconnection automatically with exponential backoff,
   * so we don't need to implement our own retry logic.
   */
  private connectAndInitializeInBackground(): void {
    // Start PowerSync connection (non-blocking by design)
    // PowerSync's connect() initiates the sync stream and handles retries internally
    this.powersync
      .connect(this.supabaseConnector)
      .then(() => {
        console.log('[System] ✓ PowerSync sync connection established');
      })
      .catch((error) => {
        // Connection failed - PowerSync will auto-retry with backoff
        // This is expected when offline or with expired tokens
        console.warn(
          '[System] PowerSync connection failed (will auto-retry):',
          error instanceof Error ? error.message : error
        );
      });

    // Initialize attachment queues in background
    // These are needed for audio uploads but not for basic app functionality
    this.initializeAttachmentQueues()
      .then(() => {
        console.log('[System] ✓ Attachment queues initialized');
      })
      .catch((error) => {
        // Log but don't block - queues will be initialized on-demand if needed
        console.warn(
          '[System] Attachment queue initialization failed:',
          error instanceof Error ? error.message : error
        );
        // Reset state so it can be retried later
        this.attachmentQueuesInitialized = false;
        this.attachmentQueueInitPromise = null;
      });
  }

  private async createUnionViews() {
    console.log('Creating union views...');

    // TEMPORARY: Force drop all union views to ensure recreation
    try {
      const existingViews = await this.powersync.getAll<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'view' AND name LIKE '%_union'`
      );
      for (const { name } of existingViews) {
        try {
          await this.powersync.execute(`DROP VIEW IF EXISTS "${name}"`);
          console.log(`Dropped existing union view: ${name}`);
        } catch (e) {
          console.warn(`Failed to drop view ${name}:`, e);
        }
      }
    } catch (e) {
      console.warn('Failed to drop existing union views:', e);
    }

    try {
      // Build CREATE VIEW statements for each app table (exclude relations/views)
      const tableNames = Object.entries(drizzleSchema)
        .filter(([_name, obj]) => is(obj as unknown, SQLiteTable))
        .map(([name]) => name);

      if (tableNames.length === 0) return;

      // Normalize spacing for comparison
      const normalize = (s: string) =>
        s
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ', ')
          .trim()
          .toLowerCase();

      // Precompute expected SQL for all views
      const plannedStatements: {
        view: string;
        dropSql: string;
        createSql: string;
      }[] = [];
      for (const [name, table] of Object.entries(drizzleSchema)) {
        if (!is(table, SQLiteTable)) continue;

        const synced = `${name}_synced`;
        const local = `${name}_local`;
        const view = name;
        const remoteColumns = getTableColumns(table);
        const localTable = drizzleSchemaLocal[
          local as keyof typeof drizzleSchemaLocal
        ] as unknown as Table;
        const localColumns = getTableColumns(localTable);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const remoteColumnNames = (Object.keys(remoteColumns) ?? []).filter(
          (col) => col !== 'source'
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const localColumnNames = (Object.keys(localColumns) ?? []).filter(
          (col) => col !== 'source'
        );

        const fallback =
          remoteColumnNames.length === 0 && localColumnNames.length === 0;

        let createSql: string;
        if (fallback) {
          createSql = `CREATE VIEW "${view}" AS SELECT 'synced' AS source, * FROM "${synced}" UNION ALL SELECT 'local' AS source, * FROM "${local}" WHERE REPLACE(id, '-', '') NOT IN (SELECT REPLACE(id, '-', '') FROM "${synced}")`;
        } else {
          const remoteSet = new Set(remoteColumnNames);
          const localSet = new Set(localColumnNames);
          const unified = [...remoteColumnNames];
          for (const col of localColumnNames) {
            if (!remoteSet.has(col)) unified.push(col);
          }
          // Special handling for invite and request tables: compute expired status dynamically
          const isExpirableTable = name === 'invite' || name === 'request';

          const syncedSelect = unified
            .map((col) => {
              // For invite/request tables, replace status column with CASE statement
              if (isExpirableTable && col === 'status') {
                return `CASE
                  WHEN "${synced}"."status" = 'pending' AND datetime("${synced}"."last_updated") < datetime('now', '-7 days')
                  THEN 'expired'
                  ELSE "${synced}"."status"
                END AS "status"`;
              }
              return remoteSet.has(col) ? `"${col}"` : `NULL AS "${col}"`;
            })
            .filter((col) => col !== 'source')
            .join(', ');
          const localSelect = unified
            .map((col) => {
              // For invite/request tables, replace status column with CASE statement
              if (isExpirableTable && col === 'status') {
                return `CASE
                  WHEN "${local}"."status" = 'pending' AND datetime("${local}"."last_updated") < datetime('now', '-7 days')
                  THEN 'expired'
                  ELSE "${local}"."status"
                END AS "status"`;
              }
              return localSet.has(col) ? `"${col}"` : `NULL AS "${col}"`;
            })
            .filter((col) => col !== 'source')
            .join(', ');

          createSql = `CREATE VIEW "${view}" AS SELECT 'synced' AS source, ${syncedSelect} FROM "${synced}" UNION ALL SELECT 'local' AS source, ${localSelect} FROM "${local}" WHERE REPLACE(id, '-', '') NOT IN (SELECT REPLACE(id, '-', '') FROM "${synced}")`;
        }

        plannedStatements.push({
          view,
          dropSql: `DROP VIEW IF EXISTS "${view}"`,
          createSql: normalize(createSql)
        });
      }

      // Fetch existing view SQL for all planned views in one query
      const viewNames = plannedStatements.map((p) => p.view);
      const existingByName = new Map<string, string>();
      if (viewNames.length > 0) {
        const placeholders = viewNames.map(() => '?').join(', ');
        const existingRows = await this.powersync.getAll<{
          name: string;
          sql: string;
        }>(
          `SELECT name, sql FROM sqlite_master WHERE type = 'view' AND name IN (${placeholders})`,
          viewNames
        );
        for (const row of existingRows) {
          if (row.name) existingByName.set(row.name, normalize(row.sql));
        }
      }
      await this.powersync.writeTransaction(async (tx) => {
        // Compare with existing view SQL and apply only when different
        for (const { view, dropSql, createSql } of plannedStatements) {
          try {
            const existing = existingByName.get(view);
            const expected = createSql;

            const viewExists = !!existing;

            // Debug logging to see what's being compared
            console.log(`Comparing view ${view}:`);
            console.log('Existing:', existing);
            console.log('Expected:', expected);
            console.log('Match:', existing === expected);

            if (existing === expected) {
              console.log(`Union view for ${view} is up to date.`);
              continue; // no change
            } else if (viewExists) {
              console.log(
                `Union view for ${view} is not up to date. Updating...`
              );
            }

            if (viewExists) await tx.execute(dropSql);
            const insertId = (await tx.execute(createSql)).insertId;

            if (!viewExists) {
              console.log(
                `Union view created for ${view}. Insert ID: ${insertId}`
              );
            }
          } catch (e) {
            console.warn(`Failed to ensure union view for ${view}:`, e);
          }
        }
      });
    } catch (error) {
      console.warn('createUnionViews encountered an error:', error);
    }
  }

  async seed() {
    if (!__DEV__) return; // Only seed in development
    console.log('Resetting database...');
    await resetDatabase();
    console.log('Database reset successfully.');
    console.log('Seeding database...');
    const time = performance.now();
    // Create a profile first
    const PROFILE_ID = 'c111d43b-5983-4342-9d9e-5fc8d09d77b9';

    async function createProject(
      i: number,
      db: PowerSyncSQLiteDatabase<typeof drizzleSchemaLocal>
    ) {
      const projectId = uuid.v4();
      const project = {
        id: projectId,
        creator_id: PROFILE_ID,
        name: `Project ${i + 1}`,
        description: `Description for project ${i + 1}`,
        download_profiles: [PROFILE_ID]
      };

      const profile_project_link = {
        id: `${PROFILE_ID}_${projectId}`,
        project_id: projectId,
        profile_id: PROFILE_ID,
        membership: 'owner' as const,
        download_profiles: [PROFILE_ID]
      };

      // Create project language links (source and target)
      const project_language_links = [
        {
          project_id: projectId,
          languoid_id: ENGLISH_LANGUOID_ID,
          language_type: 'source' as const,
          download_profiles: [PROFILE_ID]
        },
        {
          project_id: projectId,
          languoid_id: ENGLISH_LANGUOID_ID,
          language_type: 'target' as const,
          download_profiles: [PROFILE_ID]
        }
      ];

      const quests: InsertQuest[] = Array.from({ length: 5 }, (_, i) => {
        return {
          id: uuid.v4(),
          creator_id: PROFILE_ID,
          name: `Quest ${i + 1}`,
          description: `Description for quest ${i + 1}`,
          project_id: project.id,
          parent_id: null
        };
      });

      // Helper function to create quest layers recursively
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createLayers = <T extends Record<string, any>>(
        builder: (
          parent: T,
          childIndex: number,
          parentIndex: number,
          depth: number
        ) => T,
        parents: T[],
        maxDepth: number,
        questsPerParent = 5,
        depth = 1
      ): T[] => {
        if (depth > maxDepth) {
          return [];
        }

        const currentLayer = parents.flatMap((parentQuest, parentIndex) =>
          Array.from({ length: questsPerParent }, (_, childIndex) => {
            return builder(parentQuest, childIndex, parentIndex, depth);
          })
        );

        // Recursively create deeper layers
        const deeperQuests = createLayers(
          builder,
          currentLayer,
          maxDepth,
          questsPerParent,
          depth + 1
        );

        return [...currentLayer, ...deeperQuests];
      };
      // Helper function to insert quests in batches

      const insertInBatches = async <T extends unknown[]>(
        items: T,
        table: Table
      ) => {
        const tableName = getTableName(table);
        const batchSize = Math.floor(
          32766 / Object.keys(getTableColumns(table)).length
        );
        console.log(
          `Batch size: ${batchSize}, Total ${tableName}: ${items.length}`
        );
        const startTime = performance.now();

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchStartTime = performance.now();
          await db.insert(table).values(batch);
          const batchEndTime = performance.now();

          const progress = Math.min(i + batchSize, items.length);
          const percentage = ((progress / items.length) * 100).toFixed(1);
          console.log(
            `Inserted batch ${Math.floor(i / batchSize) + 1}: ${progress}/${items.length} ${tableName} (${percentage}%) - ${(batchEndTime - batchStartTime).toFixed(2)}ms`
          );
        }

        const totalTime = performance.now() - startTime;
        console.log(
          `Completed inserting ${items.length} ${tableName} in ${totalTime.toFixed(2)}ms`
        );
      };

      await db.insert(drizzleSchemaLocal.project_local).values(project);
      await db
        .insert(drizzleSchemaLocal.profile_project_link_local)
        .values(profile_project_link);
      await db
        .insert(drizzleSchemaLocal.project_language_link_local)
        .values(project_language_links);

      const allQuests = [
        ...quests,
        ...createLayers(
          (parent, childIndex, parentIndex, depth) => ({
            id: uuid.v4(),
            parent_id: parent.id,
            name: `Layer ${depth} Quest ${childIndex + 1} (Parent ${parentIndex + 1})`,
            description: `Description for layer ${depth} quest ${childIndex + 1}`,
            project_id: project.id,
            creator_id: PROFILE_ID,
            download_profiles: [PROFILE_ID]
          }),
          quests,
          4
        )
      ];
      // Insert all quests in batches to avoid SQL variable limits
      await insertInBatches(allQuests, drizzleSchemaLocal.quest_local);

      const assets: InsertAsset[] = [];
      const questAssetLinks: InsertQuestAssetLink[] = [];
      const assetContentLinks: InsertAssetContentLink[] = [];
      const votes: InsertVote[] = [];
      const leafQuests = allQuests.filter((quest) =>
        quest.name.includes('Layer 4')
      );
      console.log('Leaf quests:', leafQuests.length);
      leafQuests.forEach((quest) => {
        Array.from({ length: 3 }, (_, i) => {
          const asset: InsertAsset = {
            id: uuid.v4(),
            creator_id: PROFILE_ID,
            name: `Asset ${i + 1}`,
            images: [],
            download_profiles: [PROFILE_ID],
            project_id: project.id,
            source_asset_id: null
          };
          const translationAsset: InsertAsset = {
            id: uuid.v4(),
            source_asset_id: asset.id,
            name: 'Test',
            download_profiles: [PROFILE_ID],
            creator_id: PROFILE_ID,
            project_id: project.id
          };
          const newVotes = Array.from(
            { length: Math.round(Math.random() * 5) + 2 },
            (_, i) => {
              return {
                id: uuid.v4(),
                asset_id: translationAsset.id!,
                creator_id: PROFILE_ID,
                polarity: i % 2 === 1 ? 'up' : 'down',
                active: true,
                download_profiles: [PROFILE_ID]
              } satisfies InsertVote;
            }
          );
          votes.push(...newVotes);
          assets.push(asset);
          questAssetLinks.push({
            id: `${quest.id}_${asset.id}`,
            quest_id: quest.id!,
            asset_id: asset.id!,
            download_profiles: [PROFILE_ID]
          });
          const contentCreatedAt = new Date();
          assetContentLinks.push({
            id: uuid.v4(),
            asset_id: asset.id!,
            languoid_id: ENGLISH_LANGUOID_ID,
            text: 'Source text',
            download_profiles: [PROFILE_ID],
            created_at: contentCreatedAt.toISOString()
          });
          contentCreatedAt.setDate(contentCreatedAt.getDate() + 1);
          assetContentLinks.push({
            id: uuid.v4(),
            asset_id: asset.id!,
            languoid_id: ENGLISH_LANGUOID_ID,
            text: 'Second source text',
            download_profiles: [PROFILE_ID],
            // audio: [uuid.v4()],
            created_at: contentCreatedAt.toISOString()
          });

          assets.push(translationAsset);
          questAssetLinks.push({
            id: `${quest.id}_${translationAsset.id}`,
            quest_id: quest.id!,
            asset_id: translationAsset.id!,
            download_profiles: [PROFILE_ID]
          });
          assetContentLinks.push({
            id: uuid.v4(),
            asset_id: translationAsset.id!,
            languoid_id: ENGLISH_LANGUOID_ID,
            text: 'Translation text',
            download_profiles: [PROFILE_ID]
            // audio: [uuid.v4()]
          });
          assetContentLinks.push({
            id: uuid.v4(),
            asset_id: translationAsset.id!,
            languoid_id: ENGLISH_LANGUOID_ID,
            text: 'Second translation text',
            download_profiles: [PROFILE_ID]
          });
        });
      });

      await insertInBatches(assets, drizzleSchemaLocal.asset_local);
      await insertInBatches(
        questAssetLinks,
        drizzleSchemaLocal.quest_asset_link_local
      );
      await insertInBatches(
        assetContentLinks,
        drizzleSchemaLocal.asset_content_link_local
      );
      await insertInBatches(votes, drizzleSchemaLocal.vote_local);
    }

    for (let i = 0; i < 3; i++) {
      // @ts-expect-error abc
      await createProject(i, this.db);
    }
    console.log(`Seeding time: ${performance.now() - time}ms`);
    // await this.db
    //   .insert(drizzleSchemaLocal.quest_local)
    //   .values(layerFourQuests);

    // Insert assets
    // const assets = [];
    // for (let i = 0; i < 10; i++) {
    //   assets.push({
    //     id: uuid.v4(),
    //     creator_id: PROFILE_ID,
    //     name: `Asset ${i + 1}`,
    //     images: [],
    //     download_profiles: [PROFILE_ID],
    //     project_id: projects[i % projects.length]?.id,
    //     source_asset_id: null,
    //     target_asset_id: null
    //   });
    // }
    // await this.db.insert(drizzleSchemaLocal.asset_local).values(assets);

    // Insert quests
    // const quests = [];
    // for (let i = 0; i < 10; i++) {
    //   quests.push({
    //     id: crypto.randomUUID(),
    //     source: 'local' as const,
    //     active: true,
    //     visible: true,
    //     private: true,
    //     creator_id: PROFILE_ID,
    //     created_at: new Date(),
    //     last_updated: new Date(),
    //     name: `Quest ${i + 1}`,
    //     description: `Description for quest ${i + 1}`,
    //     download_profiles: [PROFILE_ID],
    //     project_id: projects[i % projects.length].id,
    //     parent_id: null
    //   });
    // }
    // await this.db.insert(drizzleSchemaLocal.quest_local).values(quests);
    console.log('Database seeded successfully.');
    console.log('Vacuuming database...');
    const vacuumTime = performance.now();
    await this.powersync.executeRaw('VACUUM;');
    console.log('Database vacuumed successfully. ');
    console.log(`Vacuum time: ${performance.now() - vacuumTime}ms`);
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

      // Clean up any corrupted attachments before initializing queues
      // This prevents infinite retry loops on app startup
      // Fast check first - most users won't have corrupted attachments
      console.log('[System] Checking for corrupted attachments...');
      try {
        const { getCorruptedCount, cleanupAllCorrupted } = await import(
          '@/services/corruptedAttachmentsService'
        );
        const corruptedCount = await getCorruptedCount();

        if (corruptedCount > 0) {
          console.warn(
            `[System] Found ${corruptedCount} corrupted attachment(s) with blob URLs. Cleaning up...`
          );
          // Run cleanup asynchronously to not block initialization
          void cleanupAllCorrupted().then((result) => {
            console.log(
              `[System] Cleanup complete: ${result.cleaned} cleaned, ${result.errors.length} errors`
            );
            if (result.errors.length > 0) {
              console.error('[System] Cleanup errors:', result.errors);
            }
          });
          // Don't await - let it run in background
          console.log('[System] Cleanup running in background...');
        } else {
          console.log('[System] No corrupted attachments found');
        }
      } catch (error) {
        // Don't fail initialization if cleanup fails
        console.error(
          '[System] Error during corrupted attachment cleanup:',
          error
        );
      }

      // Initialize both queues in parallel if they exist
      const initPromises: Promise<void>[] = [];

      if (this.permAttachmentQueue) {
        initPromises.push(this.permAttachmentQueue.init());
      }

      // if (this.tempAttachmentQueue && Platform.OS !== 'web') {
      //   initPromises.push(this.tempAttachmentQueue.init());
      // }

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

  /**
   * Ensures attachment queues are initialized before performing operations that need them.
   * Call this before saveAudio() or other attachment operations to handle the case where
   * the app started offline and queues weren't initialized during startup.
   *
   * @returns Promise that resolves when attachment queues are ready
   */
  async ensureAttachmentQueuesReady(): Promise<void> {
    // Already initialized - return immediately
    if (this.attachmentQueuesInitialized) {
      return;
    }

    // If currently initializing, wait for it
    if (this.attachmentQueueInitPromise) {
      await this.attachmentQueueInitPromise;
      return;
    }

    // Not initialized and not initializing - start initialization
    console.log(
      '[System] Attachment queues not ready, initializing on-demand...'
    );
    await this.initializeAttachmentQueues();
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

      // if (this.tempAttachmentQueue) {
      //   try {
      //     // Call destroy method if it exists
      //     (
      //       this.tempAttachmentQueue as unknown as { destroy?: () => void }
      //     ).destroy?.();
      //   } catch (error) {
      //     console.warn('Error destroying temporary attachment queue:', error);
      //   }
      // }

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

  /**
   * Run schema migrations with progress callback
   * Called from MigrationScreen when user needs to migrate data
   *
   * @param onProgress - Callback for progress updates (current, total, step)
   */
  async runMigrations(
    onProgress?: (current: number, total: number, step: string) => void
  ): Promise<void> {
    if (this.migratingNow) {
      console.warn('[System] Migration already in progress');
      return;
    }

    try {
      this.migratingNow = true;
      console.log('[System] Starting migration process...');

      // Dynamic import to avoid circular dependencies
      const { runMigrations, checkNeedsMigration, getMinimumSchemaVersion } =
        await import('../migrations/index');
      const { APP_SCHEMA_VERSION } = await import('../drizzleSchema');

      // Double-check that migration is still needed
      // Use Drizzle-wrapped db to query through views
      const stillNeeded = await checkNeedsMigration(
        this.db,
        APP_SCHEMA_VERSION
      );

      if (!stillNeeded) {
        console.log(
          '[System] No migration needed (already at current version)'
        );
        this.migrationNeeded = false;
        return;
      }

      // Get the actual current version from database
      // This will return '0.0' for unversioned data, or the actual minimum version found
      const currentVersion = (await getMinimumSchemaVersion(this.db)) || '0.0';
      console.log(
        `[System] Current schema version: ${currentVersion}, target: ${APP_SCHEMA_VERSION}`
      );

      // Use Drizzle-wrapped db for migration operations (queries through views)
      const result = await runMigrations(
        this.db,
        currentVersion, // Start from actual current version
        APP_SCHEMA_VERSION,
        onProgress
      );

      if (!result.success) {
        throw new Error(`Migration failed: ${result.errors.join(', ')}`);
      }

      console.log('[System] ✓ Migration completed successfully');
      this.migrationNeeded = false;
    } catch (error) {
      console.error('[System] Migration failed:', error);
      throw error;
    } finally {
      this.migratingNow = false;
    }
  }

  /**
   * Reset system state after migration completes
   * Allows re-initialization with new schema
   */
  resetForMigration(): void {
    console.log('[System] Resetting for migration...');
    this.migrationNeeded = false;
    this.initialized = false;
    this.connecting = false;
    this.connectionPromise = null;

    // This will cause useAuth to re-run system.init()
    // which will now pass the migration check
    useLocalStore.getState().setSystemReady(false);
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
    // Silently handle React internal properties and common inspection properties
    // React Compiler and DevTools will check these
    const inspectionProps = new Set([
      '$$typeof', // React element type marker
      '_reactInternals', // React internals
      'toJSON', // JSON serialization
      'then', // Promise detection
      'constructor', // Constructor inspection
      Symbol.toStringTag, // Object.prototype.toString
      Symbol.iterator // Iterator protocol
    ]);

    if (inspectionProps.has(prop)) {
      return undefined;
    }

    // Allow checking initialization state without throwing
    if (
      prop === 'isInitialized' ||
      prop === 'isPowerSyncInitialized' ||
      prop === 'areAttachmentQueuesReady' ||
      prop === 'init' ||
      prop === 'migrationNeeded' ||
      prop === 'runMigrations' ||
      prop === 'resetForMigration'
    ) {
      const instance = getSystem();
      const value = instance[prop as keyof System];
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    }

    const instance = getSystem();

    // Check if we're trying to access a critical property before initialization
    // Suppress warning when PowerSync isn't initialized - this is expected for anonymous users
    // PowerSync is intentionally not initialized for anonymous users to avoid unnecessary overhead
    // The warning was causing spam in anonymous mode, so we suppress it entirely
    // Authenticated users will see other errors if PowerSync isn't properly initialized
    if (
      !instance.isPowerSyncInitialized() &&
      (prop === 'db' || prop === 'powersync' || prop === 'permAttachmentQueue')
    ) {
      // Suppress warning - PowerSync not being initialized is expected for anonymous users
      // and will cause actual errors for authenticated users that need to be fixed anyway
    }

    const value = instance[prop as keyof System];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});
