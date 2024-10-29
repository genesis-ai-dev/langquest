import * as SQLite from 'expo-sqlite';
import { DB_CONFIG } from './config';

export interface BaseEntity {
  id: string;
  rev: number;
  createdAt?: string;
  lastUpdated?: string;
}

export interface VersionedEntity extends BaseEntity {
  versionNum: number;
  versionChainId: string;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract columns: string[];

  protected async getDatabase() {
    return await SQLite.openDatabaseAsync(DB_CONFIG.name, DB_CONFIG.options);
  }

  async getById(id: string): Promise<T | null> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(
        `SELECT * FROM ${this.tableName} WHERE id = $id`
      );
      try {
        const result = await statement.executeAsync({ $id: id });
        return await result.getFirstAsync() as T | null;
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  // Get every version (if applicable) of every record for a given table
  async getAll(): Promise<T[]> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(
        `SELECT * FROM ${this.tableName}`
      );
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

        await txn.runAsync(
          `DELETE FROM ${this.tableName} WHERE id = $id`,
          { $id: id }
        );
      });
    } finally {
      await db.closeAsync();
    }
  }

  protected async createRecord(entity: Omit<T, 'id' | 'rev'>): Promise<string> {
    // Let child classes prepare the entity before insert
    const preparedEntity = await this.prepareForInsert(entity);
    await this.validateForInsert(preparedEntity as Partial<T>);
    
    const db = await this.getDatabase();
    try {
      let newId = '';
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Get all columns including any added by child classes
        const allColumns = this.getAllColumns(preparedEntity);
  
        const insertStatement = await txn.prepareAsync(`
          INSERT INTO ${this.tableName} (
            rev, ${allColumns.join(', ')}
          ) VALUES (
            1, ${allColumns.map(c => '$' + c).join(', ')}
          )
          RETURNING id
        `);
  
        try {
          const params = allColumns.reduce((acc, col) => ({
            ...acc,
            ['$' + col]: preparedEntity[col as keyof typeof preparedEntity]
          }), {});
  
          const result = await insertStatement.executeAsync(params);
          const newRow = await result.getFirstAsync() as { id: string };
          newId = newRow?.id || '';
  
          // Move afterInsert inside the transaction
          if (newId) {
            // If this is a new versioned entity, update the versionChainId
            if ('versionNum' in preparedEntity && preparedEntity.versionNum === 1) {
              await txn.runAsync(
                `UPDATE ${this.tableName} SET versionChainId = ? WHERE id = ?`,
                [newId, newId]
              );
            }
          }
        } finally {
          await insertStatement.finalizeAsync();
        }
      });
      
      return newId;
    } finally {
      await db.closeAsync();
    }
  }

  // Methods that can be overridden by child classes
  protected async prepareForInsert(entity: Omit<T, 'id' | 'rev'>): Promise<Omit<T, 'id' | 'rev'>> {
    return entity;
  }

  protected async afterInsert(id: string, entity: Omit<T, 'id' | 'rev'>): Promise<void> {
    // No-op by default
  }

  protected getAllColumns(entity: any): string[] {
    return this.columns;
  }

  // Get time of last activity for this entity
  async getTimeLastActivity(id: string): Promise<string | null> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(
        `SELECT lastUpdated FROM ${this.tableName} WHERE id = $id`
      );
      try {
        const result = await statement.executeAsync({ $id: id });
        const row = await result.getFirstAsync() as { lastUpdated: string } | null;
        return row?.lastUpdated ?? null;
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  // Methods that must be implemented by specific repositories
  protected abstract validateForInsert(entity: Partial<T>): Promise<void>;
  protected abstract getDependencyChecks(id: string): string[];
}