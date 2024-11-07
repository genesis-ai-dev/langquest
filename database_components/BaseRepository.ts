import * as SQLite from 'expo-sqlite';
import { DB_CONFIG } from './config';
import { DatabaseManager } from './DatabaseManager';

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

export interface Relationship<T> {
  name: string;
  type: 'toOne' | 'toMany' | 'manyToMany';
  query: string;
  transform?: (rows: any[]) => T[];
  updateQuery?: {
    clear: string;
    add: string;
  };
  via?: {
    tableName: string;
    fromField: string;
    toField: string;
  };
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract columns: string[];

  // protected async getDatabase() {
  //   return await SQLite.openDatabaseAsync(DB_CONFIG.name, DB_CONFIG.options);
  // }

  protected async withConnection<T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    const dbManager = DatabaseManager.getInstance();
    const db = await dbManager.getConnection();
    try {
      return await operation(db);
    } finally {
      await dbManager.releaseConnection();
    }
  }

  async getById(id: string): Promise<T | null> {
    return this.withConnection(async (db) => {
      const statement = await db.prepareAsync(
        `SELECT * FROM ${this.tableName} WHERE id = $id`
      );
      try {
        const result = await statement.executeAsync({ $id: id });
        return await result.getFirstAsync() as T | null;
      } finally {
        await statement.finalizeAsync();
      }
    });
  }

  // Get every version (if applicable) of every record for a given table
  async getAll(): Promise<T[]> {
    return this.withConnection(async (db) => {
      const statement = await db.prepareAsync(
        `SELECT * FROM ${this.tableName}`
      );
      try {
        const result = await statement.executeAsync();
        return await result.getAllAsync() as T[];
      } finally {
        await statement.finalizeAsync();
      }
    });
  }

  async getLatestOfAll(): Promise<T[]> {
    // For non-versioned entities, latest = all
    return this.getAll();
  }

  async delete(id: string): Promise<void> {
    return this.withConnection(async (db) => {
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
    });
  }

  protected async createRecord(entity: Omit<T, 'id' | 'rev'>): Promise<string> {
    // Let child classes prepare the entity before insert
    const preparedEntity = await this.prepareForInsert(entity);
    await this.validateForInsert(preparedEntity as Partial<T>);
    
    return this.withConnection(async (db) => {
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
    });
  }

  // Methods that can be overridden by child classes
  protected async prepareForInsert(entity: Omit<T, 'id' | 'rev'>): Promise<Omit<T, 'id' | 'rev'>> {
    return entity;
  }

  protected async afterInsert(id: string, entity: Omit<T, 'id' | 'rev'>): Promise<void> {
    // No-op by default
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    // Let child classes prepare the entity before update
    const preparedUpdates = await this.prepareForUpdate(updates);
    await this.validateForUpdate(id, preparedUpdates);
    
    return this.withConnection(async (db) => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Get current record to check rev
        const current = await this.getById(id);
        if (!current) {
          throw new Error('Record not found');
        }

        // Get all columns that are being updated
        const updateColumns = Object.keys(preparedUpdates).filter(
          col => this.columns.includes(col)
        );

        if (updateColumns.length === 0) {
          return; // Nothing to update
        }

        const updateStatement = await txn.prepareAsync(`
          UPDATE ${this.tableName} 
          SET 
            rev = $newRev,
            lastUpdated = CURRENT_TIMESTAMP,
            ${updateColumns.map(col => `${col} = $${col}`).join(', ')}
          WHERE id = $id AND rev = $currentRev
        `);

        try {
          const params = {
            $id: id,
            $currentRev: current.rev,
            $newRev: current.rev + 1,
            ...updateColumns.reduce((acc, col) => ({
              ...acc,
              [`$${col}`]: preparedUpdates[col as keyof typeof preparedUpdates]
            }), {})
          };

          const result = await updateStatement.executeAsync(params);
          
          // Check if update was successful
          if (result.changes === 0) {
            throw new Error('Record was modified by another process');
          }

          // Call afterUpdate hook
          await this.afterUpdate(id, preparedUpdates);
        } finally {
          await updateStatement.finalizeAsync();
        }
      });
    });
  }

  // Methods that can be overridden by child classes
  protected async prepareForUpdate(updates: Partial<T>): Promise<Partial<T>> {
    return updates;
  }

  protected async validateForUpdate(id: string, updates: Partial<T>): Promise<void> {
    // By default, use the same validation as insert
    await this.validateForInsert(updates);
  }

  protected async afterUpdate(id: string, updates: Partial<T>): Promise<void> {
    // No-op by default
  }

  protected abstract relationships: Record<string, Relationship<any>>;

  async getRelated<R>(id: string, relationshipName: string): Promise<R[]> {
    const relationship = this.relationships[relationshipName];
    console.log('relationship', relationship);
    if (!relationship) {
      throw new Error(`Unknown relationship: ${relationshipName}`);
    }

    return this.withConnection(async (db) => {
      const statement = await db.prepareAsync(relationship.query);
      try {
        const result = await statement.executeAsync({ $id: id });
        const rows = await result.getAllAsync();
        return relationship.transform ? relationship.transform(rows) : rows as R[];
      } finally {
        await statement.finalizeAsync();
      }
    });
  }

  async updateRelation(
    entityId: string,
    relationshipName: string,
    relatedIds: string[]
  ): Promise<void> {
    const relationship = this.relationships[relationshipName];
    if (!relationship) {
      throw new Error(`Unknown relationship: ${relationshipName}`);
    }

    return this.withConnection(async (db) => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        switch (relationship.type) {
          case 'toMany':
            // For toMany relationships, we update the foreign key in the related table
            await this.updateToManyRelation(
              txn,
              entityId,
              relationshipName,
              relatedIds
            );
            break;

          case 'manyToMany':
            // For manyToMany relationships, we update the junction table
            await this.updateManyToManyRelation(
              txn,
              entityId,
              relationshipName,
              relatedIds
            );
            break;

          case 'toOne':
            throw new Error('Cannot update toOne relationships through updateRelation');
        }
      });
    });
  }

  protected async updateToManyRelation(
    txn: SQLite.SQLiteDatabase,
    entityId: string,
    relationshipName: string,
    relatedIds: string[]
  ): Promise<void> {
    const relationship = this.relationships[relationshipName];
    if (!relationship.updateQuery) {
      throw new Error(`No update query defined for relationship: ${relationshipName}`);
    }

    // Clear existing relations
    await txn.runAsync(relationship.updateQuery.clear, { $id: entityId });

    // Add new relations
    for (const relatedId of relatedIds) {
      await txn.runAsync(relationship.updateQuery.add, {
        $id: entityId,
        $relatedId: relatedId
      });
    }
  }

  protected async updateManyToManyRelation(
    txn: SQLite.SQLiteDatabase,
    entityId: string,
    relationshipName: string,
    relatedIds: string[]
  ): Promise<void> {
    const relationship = this.relationships[relationshipName];
    if (!relationship.via) {
      throw new Error(`No junction table configuration for relationship: ${relationshipName}`);
    }

    // Clear existing relations
    await txn.runAsync(
      `DELETE FROM ${relationship.via.tableName} WHERE ${relationship.via.fromField} = $id`,
      { $id: entityId }
    );

    // Add new relations
    for (const relatedId of relatedIds) {
      await txn.runAsync(
        `INSERT INTO ${relationship.via.tableName} (${relationship.via.fromField}, ${relationship.via.toField}) 
         VALUES ($id, $relatedId)`,
        { $id: entityId, $relatedId: relatedId }
      );
    }
  }

  protected getAllColumns(entity: any): string[] {
    return this.columns;
  }

  // Get time of last activity for this entity
  async getTimeLastActivity(id: string): Promise<string | null> {
    return this.withConnection(async (db) => {
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
    });
  }

  // Methods that must be implemented by specific repositories
  protected abstract validateForInsert(entity: Partial<T>): Promise<void>;
  protected abstract getDependencyChecks(id: string): string[];
}