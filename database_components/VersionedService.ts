import { eq, and, desc, SQL, max } from 'drizzle-orm';
import { db } from '../db/database';
import { BaseService } from './BaseService';
import { DrizzleTable, VersionedTableColumns } from './tableTypes';
import { VersionedSelect, VersionedInsert } from './types';

export abstract class VersionedService<
  TTable extends DrizzleTable<VersionedTableColumns>,
  TSelect extends VersionedSelect,
  TInsert extends VersionedInsert
> extends BaseService<TTable, TSelect, TInsert> {
  
  async getLatestOfAll(): Promise<TSelect[]> {
    const subquery = db
      .select({
        versionChainId: this.table.versionChainId,
        maxVersion: max(this.table.versionNum as any).as('maxVersion')
      })
      .from(this.table)
      .groupBy(this.table.versionChainId)
      .as('latest');

    return await db
      .select()
      .from(this.table)
      .innerJoin(
        subquery,
        and(
          eq(this.table.versionChainId, subquery.versionChainId),
          eq(this.table.versionNum as any, subquery.maxVersion)
        )
      )
      .orderBy(this.getDefaultOrderBy()) as TSelect[];
  }

  protected getLatestVersionsSubquery() {
    return db
      .select({
        versionChainId: this.table.versionChainId,
        maxVersion: max(this.table.versionNum as any).as('maxVersion')
      })
      .from(this.table)
      .groupBy(this.table.versionChainId)
      .as('latest');
  }

  async getLatestVersion(chainId: string): Promise<TSelect | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.versionChainId, chainId))
      .orderBy(desc(this.table.versionNum as any))
      .limit(1);
    
    return record as TSelect;
  }

  async getVersions(chainId: string): Promise<TSelect[]> {
    return await db
      .select()
      .from(this.table)
      .where(eq(this.table.versionChainId, chainId))
      .orderBy(desc(this.table.versionNum as any)) as TSelect[];
  }

  async createNew(data: Omit<TInsert, keyof VersionedInsert>): Promise<TSelect> {
    return await this.create({
      ...data,
      versionNum: 1,
      versionChainId: '',  // Will be updated to match id after creation
      rev: 1
    } as TInsert);
  }

  async addVersion(
    baseVersion: TSelect,
    updates: Partial<Omit<TInsert, keyof VersionedInsert>>
  ): Promise<TSelect> {
    return await this.create({
      ...baseVersion,
      ...updates,
      versionNum: baseVersion.versionNum + 1,
      versionChainId: baseVersion.versionChainId,
      rev: 1
    } as TInsert);
  }

  protected abstract getDefaultOrderBy(): SQL<unknown>;

  protected override async create(data: TInsert): Promise<TSelect> {
    const record = await super.create(data);
    
    if (data.versionNum === 1) {
      return await this.update(record.id, {
        versionChainId: record.id
      } as Partial<TInsert>);
    }
    
    return record;
  }
}