import * as SQLite from 'expo-sqlite';
import { DB_CONFIG } from './config';

export interface BaseEntity {
  id: string;
  rev: number;
  versionNum: number;
  versionChainId: string;
  createdAt?: string;
  lastUpdated?: string;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract columns: string[];
  
  protected async getDatabase() {
    return await SQLite.openDatabaseAsync(DB_CONFIG.name, DB_CONFIG.options);
  }
  
  // Get all latest versions of entities
  async getLatest(): Promise<T[]> {
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

  // Add a new version of an entity
  async addVersion(base: T, updates: Partial<T>): Promise<string> {
    const db = await this.getDatabase();
    try {
      let newId = '';
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Get next version number
        const versionStatement = await txn.prepareAsync(`
          SELECT MAX(versionNum) as maxVersion 
          FROM ${this.tableName} 
          WHERE versionChainId = $chainId
        `);

        try {
          const result = await versionStatement.executeAsync({
            $chainId: base.versionChainId
          });
          const { maxVersion } = await result.getFirstAsync() as { maxVersion: number };
          const nextVersion = (maxVersion || 0) + 1;

          // Create insert statement dynamically based on columns
          const insertStatement = await txn.prepareAsync(`
            INSERT INTO ${this.tableName} (
              rev, ${this.columns.join(', ')},
              versionNum, versionChainId
            ) VALUES (
              1, ${this.columns.map(c => '$' + c).join(', ')},
              $versionNum, $versionChainId
            )
            RETURNING id
          `);

          try {
            // Prepare parameters
            const params = this.columns.reduce((acc, col) => ({
              ...acc,
              ['$' + col]: updates[col as keyof T] ?? base[col as keyof T]
            }), {
              $versionNum: nextVersion,
              $versionChainId: base.versionChainId
            });

            const insertResult = await insertStatement.executeAsync(params);
            const newRow = await insertResult.getFirstAsync() as { id: string };
            newId = newRow?.id || '';
          } finally {
            await insertStatement.finalizeAsync();
          }
        } finally {
          await versionStatement.finalizeAsync();
        }
      });
      return newId;
    } finally {
      await db.closeAsync();
    }
  }

  // Delete an entity after checking dependencies
  async delete(id: string): Promise<void> {
    const db = await this.getDatabase();
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Check all dependencies
        const dependencyChecks = this.getDependencyChecks(id);
        for (const check of dependencyChecks) {
          const result = await txn.getFirstAsync<{ count: number }>(check);
          if ((result?.count ?? 0) > 0) {
            throw new Error(`Cannot delete: ${this.tableName} is referenced by other entities`);
          }
        }

        // If all checks pass, delete the entity
        await txn.runAsync(
          `DELETE FROM ${this.tableName} WHERE id = $id`,
          { $id: id }
        );
      });
    } finally {
      await db.closeAsync();
    }
  }

  // Methods that must be implemented by specific repositories
  protected abstract validateForInsert(entity: Partial<T>): Promise<void>;
  protected abstract getDefaultOrderBy(): string;
  protected abstract getDependencyChecks(id: string): string[];
}