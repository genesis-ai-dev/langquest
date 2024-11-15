import { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { text, integer } from 'drizzle-orm/sqlite-core';

export interface BaseTableColumns {
  id: ReturnType<typeof text>;
  rev: ReturnType<typeof integer>;
  createdAt: ReturnType<typeof text>;
  lastUpdated: ReturnType<typeof text>;
}

export interface VersionedTableColumns extends BaseTableColumns {
  versionChainId: ReturnType<typeof text>;
  versionNum: ReturnType<typeof integer>;
}

export type DrizzleTable<T> = SQLiteTable & {
//   $tableName: string;
// } & {
  [K in keyof T]: SQLiteColumn<any>;
};