/**
 * One-shot layout upgrade: collapse PowerSync _local / _synced / union-view
 * triplicate into one table per entity.
 *
 * PowerSync's constructor calls powersync_replace_schema immediately, which
 * drops tables not in the current schema. Staging unpublished drafts in a
 * JSON file (not SQLite) is the only store that survives that apply.
 *
 * Call prepareSingleTableLayout() on a raw SQLite handle before constructing
 * PowerSync. After powersync.init(), call reinsertUnpublishedDrafts() so
 * drafts enter ps_crud.
 */
import {
  deleteIfExists,
  fileExists,
  getDocumentDirectory,
  readFile,
  writeFile
} from '@/utils/fileUtils';
import { normalizeUuid, toDashedUuid } from '@/utils/uuidUtils';
import type { DrizzleDB } from './index';
import { APP_SCHEMA_VERSION } from '../constants';
import * as drizzleSchema from '../drizzleSchema';
import { is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { updateMetadataVersion } from './utils';

export const SINGLE_TABLE_NAMES = [
  'profile',
  'language',
  'project',
  'quest',
  'asset',
  'tag',
  'quest_asset_link',
  'quest_tag_link',
  'asset_tag_link',
  'asset_content_link',
  'vote',
  'reports',
  'feedback',
  'invite',
  'request',
  'notification',
  'profile_project_link',
  'project_language_link',
  'subscription',
  'blocked_users',
  'blocked_content',
  'languoid',
  'languoid_alias',
  'languoid_source',
  'languoid_property',
  'region',
  'region_alias',
  'region_source',
  'region_property',
  'languoid_region',
  'languoid_link_suggestion',
  'project_languoid_suggestion',
  'quest_closure',
  'project_closure'
] as const;

export type SingleTableName = (typeof SINGLE_TABLE_NAMES)[number];

export type UpgradeDraftRow = { id: string; data: string };

export type UpgradeDraftsFile = {
  version: 1;
  tables: Partial<Record<SingleTableName, UpgradeDraftRow[]>>;
};

const UPGRADE_FILENAME = 'ps_upgrade_2_6_drafts.json';
const LOG = '[SingleTableUpgrade]';

export type PreSingleTableObject = {
  type: string;
  name: string;
};

function numericCount(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function upgradeFilePath(): string {
  const doc = getDocumentDirectory() ?? '';
  const base = doc.endsWith('/') ? doc : `${doc}/`;
  return `${base}${UPGRADE_FILENAME}`;
}

async function pathExists(uri: string): Promise<boolean> {
  return Boolean(await Promise.resolve(fileExists(uri)));
}

async function writeTextFile(uri: string, contents: string): Promise<void> {
  await Promise.resolve(writeFile(uri, contents));
}

async function removeFile(uri: string): Promise<void> {
  await Promise.resolve(deleteIfExists(uri));
}

async function tableOrViewExists(
  db: DrizzleDB,
  name: string
): Promise<boolean> {
  const result = await db.getAll(
    `SELECT COUNT(*) as count FROM sqlite_master WHERE name=? AND type IN ('table', 'view')`,
    [name]
  );
  return numericCount((result[0] as { count?: unknown })?.count) > 0;
}

async function copyIfExists(
  db: DrizzleDB,
  fromTable: string,
  toTable: string
): Promise<number> {
  if (!(await tableOrViewExists(db, fromTable))) return 0;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${toTable} (
      id TEXT PRIMARY KEY,
      data TEXT
    )
  `);
  await db.execute(`
    INSERT OR IGNORE INTO ${toTable} (id, data)
    SELECT id, data FROM ${fromTable}
  `);
  const countResult = await db.getAll(
    `SELECT COUNT(*) as count FROM ${toTable}`,
    []
  );
  return numericCount((countResult[0] as { count?: unknown })?.count);
}

function prepareDraftData(table: string, raw: string, id: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    delete parsed.source;
    // PowerSync keeps `id` on the raw PK column, not inside `data`. Put it
    // back so a later Drizzle insert does not mint a new UUID.
    parsed.id = toDashedUuid(id);
    if (table === 'quest') {
      parsed.published_at = null;
    }
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

function parseDraftRow(data: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parentIdFromDraft(data: string): string | null {
  const parsed = parseDraftRow(data);
  const parentId = parsed?.parent_id;
  return typeof parentId === 'string' && parentId.length > 0 ? parentId : null;
}

/** Parents before children so reinsert does not hang FKs off a missing row. */
function sortQuestDrafts(rows: UpgradeDraftRow[]): UpgradeDraftRow[] {
  const byId = new Map(
    rows.map((row) => [normalizeUuid(row.id), row] as const)
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: UpgradeDraftRow[] = [];

  const visit = (row: UpgradeDraftRow) => {
    const key = normalizeUuid(row.id);
    if (visited.has(key) || visiting.has(key)) return;
    visiting.add(key);
    const parentId = parentIdFromDraft(row.data);
    if (parentId) {
      const parent = byId.get(normalizeUuid(parentId));
      if (parent) visit(parent);
    }
    visiting.delete(key);
    visited.add(key);
    ordered.push(row);
  };

  for (const row of rows) visit(row);
  return ordered;
}

/**
 * Leftover 2.5 objects: ps_data_local__* tables, *_synced storage, and
 * union views that still combine _local / _synced (including quest_aggregates).
 *
 * Uses GLOB so '_' is literal. SQL LIKE '_' is a single-character wildcard
 * and missed names like quest_aggregates.
 */
async function listPreSingleTableSchemaObjects(
  db: DrizzleDB
): Promise<PreSingleTableObject[]> {
  const result = await db.getAll(
    `SELECT type, name FROM sqlite_master
     WHERE type IN ('table', 'view')
       AND (
         name GLOB 'ps_data_local__*'
         OR name GLOB '*_local'
         OR name GLOB '*_synced'
         OR (
           type = 'view'
           AND instr(lower(COALESCE(sql, '')), 'union all') > 0
           AND (
             instr(COALESCE(sql, ''), '_local') > 0
             OR instr(COALESCE(sql, ''), '_synced') > 0
           )
         )
       )`,
    []
  );
  return (result as PreSingleTableObject[]).filter(
    (row) => typeof row?.name === 'string' && row.name.length > 0
  );
}

export async function needsSingleTableUpgrade(db: DrizzleDB): Promise<boolean> {
  const objects = await listPreSingleTableSchemaObjects(db);
  if (objects.length > 0) {
    console.log(
      `${LOG} Pre-2.6 schema still present: ${objects
        .map((row) => `${row.type}:${row.name}`)
        .join(', ')}`
    );
    return true;
  }
  return false;
}

async function hasPendingDraftImport(): Promise<boolean> {
  return pathExists(upgradeFilePath());
}

async function loadPendingDrafts(): Promise<UpgradeDraftsFile | null> {
  const path = upgradeFilePath();
  if (!(await pathExists(path))) return null;

  const buffer = await readFile(path);
  const text = new TextDecoder().decode(buffer);
  const parsed = JSON.parse(text) as UpgradeDraftsFile;
  if (parsed?.version !== 1 || typeof parsed.tables !== 'object') {
    throw new Error(`${LOG} Invalid drafts file at ${path}`);
  }
  return parsed;
}

async function clearPendingDrafts(): Promise<void> {
  await removeFile(upgradeFilePath());
}

async function mergeAndWriteDrafts(
  incoming: UpgradeDraftsFile
): Promise<number> {
  const existing = (await loadPendingDrafts().catch(() => null)) ?? {
    version: 1 as const,
    tables: {}
  };

  let total = 0;
  for (const table of SINGLE_TABLE_NAMES) {
    const byId = new Map<string, UpgradeDraftRow>();
    for (const row of existing.tables[table] ?? []) {
      byId.set(row.id, row);
    }
    for (const row of incoming.tables[table] ?? []) {
      byId.set(row.id, row);
    }
    const merged = [...byId.values()];
    if (merged.length > 0) {
      existing.tables[table] = merged;
      total += merged.length;
    }
  }

  if (total === 0) return 0;

  await writeTextFile(upgradeFilePath(), JSON.stringify(existing));
  const wrote = await pathExists(upgradeFilePath());
  if (!wrote) {
    throw new Error(`${LOG} Failed to write drafts file`);
  }
  console.log(`${LOG} Wrote drafts file ${upgradeFilePath()}`);
  return total;
}

async function collectUnpublishedDrafts(
  db: DrizzleDB
): Promise<UpgradeDraftsFile> {
  const tables: UpgradeDraftsFile['tables'] = {};

  for (const table of SINGLE_TABLE_NAMES) {
    const localRaw = `ps_data_local__${table}_local`;
    if (!(await tableOrViewExists(db, localRaw))) continue;

    const syncedRaw = `ps_data__${table}`;
    const syncedViewRaw = `ps_data__${table}_synced`;
    const excludeParts: string[] = [];
    if (await tableOrViewExists(db, syncedRaw)) {
      excludeParts.push(`SELECT REPLACE(id, '-', '') FROM ${syncedRaw}`);
    }
    if (await tableOrViewExists(db, syncedViewRaw)) {
      excludeParts.push(`SELECT REPLACE(id, '-', '') FROM ${syncedViewRaw}`);
    }
    const excludeSql =
      excludeParts.length > 0
        ? `AND REPLACE(local.id, '-', '') NOT IN (${excludeParts.join(' UNION ')})`
        : '';

    const rows = (await db.getAll(
      `SELECT local.id as id, local.data as data
       FROM ${localRaw} local
       WHERE 1=1
       ${excludeSql}`,
      []
    )) as UpgradeDraftRow[];

    const prepared = rows
      .filter(
        (row) => typeof row?.id === 'string' && typeof row.data === 'string'
      )
      .map((row) => ({
        id: row.id,
        data: prepareDraftData(table, row.data, row.id)
      }));

    if (prepared.length > 0) {
      tables[table] = prepared;
      console.log(
        `${LOG} Collected ${prepared.length} unpublished ${table} row(s)`
      );
    }
  }

  return { version: 1, tables };
}

async function dropLeftoverObjects(db: DrizzleDB): Promise<void> {
  const objects = await listPreSingleTableSchemaObjects(db);
  const views = objects.filter((row) => row.type === 'view');
  const tables = objects.filter((row) => row.type === 'table');

  for (const row of views) {
    console.log(`${LOG} Dropping leftover view ${row.name}`);
    await db.execute(`DROP VIEW IF EXISTS "${row.name}"`);
  }
  for (const row of tables) {
    console.log(`${LOG} Dropping leftover table ${row.name}`);
    await db.execute(`DROP TABLE IF EXISTS "${row.name}"`);
  }
}

/**
 * Copy *_synced into unsuffixed ps_data__* tables, stage unpublished
 * *_local rows in a JSON file, stamp published_at on previously synced
 * quests only, then drop leftover _local / _synced tables and union views.
 *
 * Idempotent. Does not construct PowerSync and does not insert into ps_crud.
 */
export async function runSingleTableUpgrade(
  db: DrizzleDB,
  onProgress?: (current: number, total: number, step: string) => void
): Promise<void> {
  const leftover = await listPreSingleTableSchemaObjects(db);
  if (leftover.length === 0) {
    console.log(`${LOG} No leftover _local/_synced objects`);
    return;
  }

  const total = SINGLE_TABLE_NAMES.length + 4;
  let step = 0;
  const bump = (message: string) => {
    step += 1;
    onProgress?.(step, total, message);
  };

  const localRawPresent = await db.getAll(
    `SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'ps_data_local__*'`,
    []
  );
  console.log(
    `${LOG} Local-only tables present: ${
      (localRawPresent as { name?: string }[])
        .map((row) => row.name)
        .filter(Boolean)
        .join(', ') || '(none)'
    }`
  );

  for (const table of SINGLE_TABLE_NAMES) {
    bump(`Copying ${table}`);
    const copied = await copyIfExists(
      db,
      `ps_data__${table}_synced`,
      `ps_data__${table}`
    );
    if (copied > 0) {
      console.log(`${LOG} Copied ${copied} ${table} row(s) from *_synced`);
    }
  }

  bump('Saving unpublished drafts');
  const collected = await collectUnpublishedDrafts(db);
  const draftCount = await mergeAndWriteDrafts(collected);
  console.log(`${LOG} Staged ${draftCount} unpublished draft row(s) to JSON`);

  bump('Stamping published_at on previously synced quests');
  // Only stamp rows that came from the old *_synced table. After 2.6, drafts
  // live in ps_data__quest with published_at NULL — do not publish them.
  if (await tableOrViewExists(db, 'ps_data__quest_synced')) {
    await db.execute(`
      UPDATE ps_data__quest_synced
      SET data = json_set(
        data,
        '$.published_at',
        COALESCE(json_extract(data, '$.created_at'), datetime('now'))
      )
      WHERE json_extract(data, '$.published_at') IS NULL
    `);
    if (await tableOrViewExists(db, 'ps_data__quest')) {
      await db.execute(`
        UPDATE ps_data__quest
        SET data = json_set(
          data,
          '$.published_at',
          COALESCE(json_extract(data, '$.created_at'), datetime('now'))
        )
        WHERE json_extract(data, '$.published_at') IS NULL
          AND REPLACE(id, '-', '') IN (
            SELECT REPLACE(id, '-', '') FROM ps_data__quest_synced
          )
      `);
    }
  }

  bump('Dropping leftover _local/_synced tables and views');
  await dropLeftoverObjects(db);

  bump('Stamping schema version on copied rows');
  await updateMetadataVersion(db, APP_SCHEMA_VERSION);

  console.log(`${LOG} Complete`);
}

/**
 * Run the leftover 2.5 layout upgrade if this database still has it.
 * Idempotent. Call on a raw SQLite handle before constructing PowerSync.
 */
export async function prepareSingleTableLayout(
  db: DrizzleDB,
  onProgress?: (current: number, total: number, step: string) => void
): Promise<void> {
  if (!(await needsSingleTableUpgrade(db))) return;
  console.log(`${LOG} Running leftover single-table layout upgrade...`);
  await runSingleTableUpgrade(db, onProgress);
}

/**
 * Starting version for findMigrationPath. Leftover 2.5 layout with no
 * versioned rows is 2.5, not 0.0 (0.0 would replay the whole chain).
 */
export async function schemaVersionForMigration(
  db: DrizzleDB,
  minVersion: string | null
): Promise<string> {
  if (minVersion) return minVersion;
  if (await needsSingleTableUpgrade(db)) return '2.5';
  return '0.0';
}

function valuesForReinsert(
  tableName: string,
  row: UpgradeDraftRow
): Record<string, unknown> {
  const parsed = parseDraftRow(row.data) ?? {};
  delete parsed.source;
  delete parsed._metadata;
  parsed.id = toDashedUuid(row.id);
  if (tableName === 'quest') {
    parsed.published_at = null;
    if (typeof parsed.parent_id === 'string' && parsed.parent_id.length > 0) {
      parsed.parent_id = toDashedUuid(parsed.parent_id);
    }
  }
  return parsed;
}

/**
 * After powersync.init(), insert staged unpublished drafts through Drizzle
 * so they enter ps_crud. No-op if the JSON file is missing.
 */
export async function reinsertUnpublishedDrafts(ctx: {
  getAll: <T = { id: string }>(sql: string, params?: unknown[]) => Promise<T[]>;
  insert: (
    table: SQLiteTable,
    values: Record<string, unknown>
  ) => Promise<void>;
}): Promise<void> {
  if (!(await hasPendingDraftImport())) {
    console.log(
      `${LOG} No unpublished drafts file to re-insert (${upgradeFilePath()})`
    );
    return;
  }

  const drafts = await loadPendingDrafts();
  if (!drafts) {
    console.log(`${LOG} No unpublished drafts file to re-insert`);
    return;
  }

  const schemaTables = Object.fromEntries(
    Object.entries(drizzleSchema).filter(([, table]) => is(table, SQLiteTable))
  ) as Record<string, (typeof drizzleSchema)[keyof typeof drizzleSchema]>;

  let rowFailures = 0;
  let inserted = 0;

  for (const [tableName, rows] of Object.entries(drafts.tables)) {
    if (!rows || rows.length === 0) continue;

    const table = schemaTables[tableName];
    if (!table || !is(table, SQLiteTable)) {
      console.warn(
        `${LOG} No Drizzle table for unpublished ${tableName}, skipping`
      );
      rowFailures += rows.length;
      continue;
    }

    const ordered =
      tableName === 'quest' ? sortQuestDrafts(rows) : rows;

    for (const row of ordered) {
      try {
        const existing = await ctx.getAll<{ id: string }>(
          `SELECT id FROM "${tableName}" WHERE REPLACE(id, '-', '') = REPLACE(?, '-', '') LIMIT 1`,
          [row.id]
        );
        if (existing.length > 0) {
          continue;
        }

        await ctx.insert(table, valuesForReinsert(tableName, row));
        inserted += 1;
      } catch (error) {
        rowFailures += 1;
        console.warn(
          `${LOG} Failed to re-insert ${tableName} ${row.id}:`,
          error
        );
      }
    }
  }

  if (rowFailures > 0) {
    console.warn(
      `${LOG} Unpublished draft re-insert had ${rowFailures} failure(s); keeping JSON for retry`
    );
    return;
  }

  await clearPendingDrafts();
  console.log(
    `${LOG} Unpublished draft re-insert complete (${inserted} row(s))`
  );
}
