import { eq, and, desc, SQL, max } from 'drizzle-orm';
import { db } from '../db/database';
import { BaseService, DisplayField } from './BaseService';
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

  protected abstract getDefaultOrderBy(): SQL<unknown>;

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

  async createNew(data: Omit<TInsert, keyof VersionedInsert | 'rev'>): Promise<TSelect> {
    return await this.create({
      ...data,
      versionNum: 1,
      versionChainId: '',  // Will be updated to match id after creation
      rev: 1
    } as TInsert);
  }

  async addVersion(
    baseVersion: TSelect,
    updates: Partial<Omit<TInsert, keyof VersionedInsert | 'rev'>>
  ): Promise<TSelect> {
    return await this.create({
      ...baseVersion,
      ...updates,
      versionNum: baseVersion.versionNum + 1,
      versionChainId: baseVersion.versionChainId,
      rev: 1
    } as TInsert);
  }

  async updateVersion(
    id: string,
    updates: Partial<Omit<TInsert, keyof VersionedInsert | 'rev'>>
  ): Promise<TSelect> {
    return await this.update(id, updates as Partial<TInsert>);
  }


  abstract override getDisplayConfig(): {
    card: {
      title: (record: TSelect) => React.ReactNode;
      subtitle?: (record: TSelect) => React.ReactNode;
      content: (record: TSelect) => React.ReactNode[];
    };
    details: {
      sections: Array<{
        title: string;
        content: (record: TSelect) => React.ReactNode[];
      }>;
      versionControls: {
        onPreviousVersion?: (record: TSelect) => Promise<TSelect | undefined>;
        onNextVersion?: (record: TSelect) => Promise<TSelect | undefined>;
        getVersionInfo: (record: TSelect) => Promise<{
          current: number;
          total: number;
          isLatest: boolean;
        }>;
      };
    };
    create: {
      fields: (record?: TSelect) => Record<keyof Omit<TInsert, 'rev'>, DisplayField<any>>;
    };
    edit: {
      fields: (record: TSelect) => Record<keyof Omit<TInsert, 'rev'>, DisplayField<any>>;
    };
  };

  protected async getVersionInfo(record: TSelect) {
    const versions = await this.getVersions(record.versionChainId);
    return {
      current: record.versionNum,
      total: versions.length,
      isLatest: record.versionNum === versions[0].versionNum
    };
  }

  protected async getAdjacentVersion(
    record: TSelect,
    direction: 'previous' | 'next'
  ): Promise<TSelect | undefined> {
    const targetVersion = direction === 'previous' 
      ? record.versionNum - 1 
      : record.versionNum + 1;

    return await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.versionChainId, record.versionChainId),
          eq(this.table.versionNum as any, targetVersion)
        )
      )
      .then(records => records[0] as TSelect | undefined);
  }

  protected async getPreviousVersion(record: TSelect): Promise<TSelect | undefined> {
    return this.getAdjacentVersion(record, 'previous');
  }
  
  protected async getNextVersion(record: TSelect): Promise<TSelect | undefined> {
    return this.getAdjacentVersion(record, 'next');
  }
}