import { BaseRepository, BaseEntity, VersionedEntity } from './BaseRepository';

// export interface VersionedEntity extends BaseEntity {
//   versionNum: number;
//   versionChainId: string;
// }

// Export versionedEntity
export { VersionedEntity };

export abstract class VersionedRepository<T extends VersionedEntity> extends BaseRepository<T> {
  protected override getAllColumns(entity: any): string[] {
    return [...super.getAllColumns(entity), 'versionNum', 'versionChainId'];
    }

    // Get all latest versions of entities
  async getLatestOfAll(): Promise<T[]> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT t1.* 
        FROM ${this.tableName} t1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM ${this.tableName}
          GROUP BY versionChainId
        ) t2 
        ON t1.versionChainId = t2.versionChainId 
        AND t1.versionNum = t2.maxVersion
        ORDER BY ${this.getDefaultOrderBy()}
      `);

      try {
        const result = await statement.executeAsync();
        return await result.getAllAsync() as T[];
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  // Get current version of a chain
  async getLatestOfOne(chainId: string): Promise<T | null> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT t1.* 
        FROM ${this.tableName} t1
        INNER JOIN (
          SELECT MAX(versionNum) as maxVersion
          FROM ${this.tableName}
          WHERE versionChainId = $chainId
        ) t2 
        WHERE t1.versionChainId = $chainId 
        AND t1.versionNum = t2.maxVersion
      `);

      try {
        const result = await statement.executeAsync({ $chainId: chainId });
        return await result.getFirstAsync() as T | null;
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  // Get all versions of a specific chain
  async getVersions(chainId: string): Promise<T[]> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT * FROM ${this.tableName}
        WHERE versionChainId = $chainId
        ORDER BY versionNum DESC
      `);

      try {
        const result = await statement.executeAsync({ $chainId: chainId });
        return await result.getAllAsync() as T[];
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  protected override async prepareForInsert(entity: Omit<T, 'id' | 'rev'>): Promise<Omit<T, 'id' | 'rev'>> {
    const prepared = await super.prepareForInsert(entity) as any;
    
    if (!('versionNum' in prepared)) {
      return {
        ...prepared,
        versionNum: 1,
        versionChainId: ''
      };
    }
    return prepared;
  }

  // Public methods for versioning
  async createNew(entity: Omit<T, 'id' | 'rev' | 'versionNum' | 'versionChainId'>): Promise<string> {
    const versionedEntity = {
      ...entity,
      versionNum: 1,
      versionChainId: ''
    } as Omit<T, 'id' | 'rev'>;
    
    return await this.createRecord(versionedEntity);
  }

  async addVersion(base: T, updates: Partial<Omit<T, 'id' | 'rev' | 'versionNum' | 'versionChainId'>>): Promise<string> {
    const nextVersion = {
      ...base,
      ...updates,
      versionNum: base.versionNum + 1,
      versionChainId: base.versionChainId
    } as Omit<T, 'id' | 'rev'>;
    
    return await this.createRecord(nextVersion);
  }

  // Method that must be implemented by specific repositories
  protected abstract getDefaultOrderBy(): string;
  protected abstract validateForInsert(entity: Partial<T>): Promise<void>;
}