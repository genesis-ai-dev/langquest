import { eq, and, desc, SQL, max } from 'drizzle-orm';
import { SQLiteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { db } from '../db/database';
import { BaseService, BaseEntity, BaseTable } from './BaseService';

export interface VersionedEntity extends BaseEntity {
  versionChainId: string;
  versionNum: number;
}

export interface VersionedTable extends BaseTable {
  versionChainId: ReturnType<typeof text>;
  versionNum: ReturnType<typeof integer>;
}

export abstract class VersionedService<
  TTable extends VersionedTable,
  TEntity extends VersionedEntity
> extends BaseService<TTable, TEntity> {
  
  async getLatestOfAll(): Promise<TEntity[]> {
    const subquery = db
      .select({
      versionChainId: this.table.versionChainId,
      maxVersion: max(this.table.versionNum as any)
      })
      .from(this.table)
      .groupBy(this.table.versionChainId as any)
      .as('latest');

    const records = await db
      .select()
      .from(this.table)
      .innerJoin(
      subquery,
      and(
        eq(this.table.versionChainId as any, subquery.versionChainId),
        eq(this.table.versionNum as any, subquery.maxVersion)
      )
      )
      .orderBy(this.getDefaultOrderBy());

    // Fixed line: access the record directly since Drizzle already formats it correctly
    return records.map(r => ({...r})) as TEntity[];
    }

  async getLatestVersion(chainId: string): Promise<TEntity | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.versionChainId as any, chainId))
      .orderBy(desc(this.table.versionNum as any))
      .limit(1);
    
    return record as TEntity;
  }

  async getVersions(chainId: string): Promise<TEntity[]> {
    return await db
      .select()
      .from(this.table)
      .where(eq(this.table.versionChainId as any, chainId))
      .orderBy(desc(this.table.versionNum as any)) as TEntity[];
  }

  async createNew(data: Omit<TEntity, keyof VersionedEntity>): Promise<TEntity> {
    return await this.create({
      ...data,
      versionNum: 1,
      versionChainId: ''  // Will be updated to match id after creation
    } as any);
  }

  async addVersion(
    baseVersion: TEntity,
    updates: Partial<Omit<TEntity, keyof VersionedEntity>>
  ): Promise<TEntity> {
    return await this.create({
      ...baseVersion,
      ...updates,
      versionNum: baseVersion.versionNum + 1,
      versionChainId: baseVersion.versionChainId
    } as any);
  }

  protected abstract getDefaultOrderBy(): SQL<unknown>;

  // Override create to handle versionChainId
  protected override async create(
    data: Omit<TEntity, keyof BaseEntity>
  ): Promise<TEntity> {
    const record = await super.create(data);
    
    // If this is a new chain (versionNum === 1), set versionChainId to match id
    if ((data as any).versionNum === 1) {
      return await this.update(record.id, {
        versionChainId: record.id
      } as any);
    }
    
    return record;
  }
}