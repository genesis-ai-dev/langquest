import { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseManager } from './management/DatabaseManager';
import { Entity } from './Entity';
import { BatchIterator, QueryResult } from './management/BatchIterator';

export interface QueryOptions {
  batchSize?: number;
  orderBy?: string;
  filter?: Record<string, any>;
}

export abstract class BaseRepository<T extends Entity> {
  protected abstract tableName: string;

  constructor(protected dbManager: DatabaseManager) {}

  async findById(id: string): Promise<T | null> {
    const db = await this.dbManager.getConnection();
    try {
      const result = await db.getFirstAsync<Record<string, any>>(
        `SELECT * FROM ${this.tableName} WHERE id = ?`,
        [id]
      );
      return result ? this.createEntity(result, false) : null;
    } finally {
      await this.dbManager.releaseConnection();
    }
  }

  async findBy(criteria: Record<string, any>): Promise<T[]> {
    const conditions = Object.keys(criteria).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(criteria);

    const db = await this.dbManager.getConnection();
    try {
      const results = await db.getAllAsync<Record<string, any>>(
        `SELECT * FROM ${this.tableName} WHERE ${conditions}`,
        values
      );
      return results.map(result => this.createEntity(result, false));
    } finally {
      await this.dbManager.releaseConnection();
    }
  }

  async findAll(options: QueryOptions = {}): Promise<BatchIterator<T>> {
    const queryFn = async (offset: number, limit: number): Promise<QueryResult<T>> => {
      const db = await this.dbManager.getConnection();
      try {
        let query = `SELECT * FROM ${this.tableName}`;
        const params: any[] = [];

        if (options.filter) {
          const conditions = Object.entries(options.filter)
            .map(([key]) => `${key} = ?`)
            .join(' AND ');
          query += ` WHERE ${conditions}`;
          params.push(...Object.values(options.filter));
        }

        if (options.orderBy) {
          query += ` ORDER BY ${options.orderBy}`;
        }

        const countResult = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM (${query})`,
          params
        );
        const totalCount = countResult?.count ?? 0;

        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const results = await db.getAllAsync<Record<string, any>>(query, params);
        const items = results.map(result => this.createEntity(result, false));

        return { items, totalCount };
      } finally {
        await this.dbManager.releaseConnection();
      }
    };

    return new BatchIterator<T>(queryFn, options.batchSize);
  }

  async save(entity: T): Promise<void> {
    const db = await this.dbManager.getConnection();
    try {
      await db.withExclusiveTransactionAsync(async () => {
        const state = entity._forRepository.getPersistenceState();
        if (state.isNew) {
          await this.insert(db, entity);
        } else {
          await this.update(db, entity);
        }
        await this.processUncommittedChanges(entity);
      });
    } finally {
      await this.dbManager.releaseConnection();
    }
  }

  protected async processUncommittedChanges(entity: T): Promise<void> {
    const state = entity._forRepository.getPersistenceState();
    const changes = state.uncommittedChanges;
    
    // Process each uncommitted change
    for (const change of changes) {
      switch (change.type) {
        case 'AttributeChanged':
          // Handle attribute changes if needed*****************************
          break;
        // Add other change types as needed
      }
    }
  
    // Clear uncommitted changes after processing
    entity._forRepository.updatePersistenceState({
      uncommittedChanges: []
    });
  }

  private async insert(db: SQLiteDatabase, entity: T): Promise<void> {
    const attributes = entity._forRepository.getAttributes();
    const columns = Object.keys(attributes);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(attributes);

    const result = await db.runAsync(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    entity._forRepository.updatePersistenceState({
      isNew: false,
      isDirty: false,
      uncommittedChanges: []
    });

    if (result.lastInsertRowId) {
      entity._forRepository.updateAttributes({
        id: result.lastInsertRowId.toString()
      });
    }
  }

  private async update(db: SQLiteDatabase, entity: T): Promise<void> {
    const attributes = entity._forRepository.getAttributes();
    const columns = Object.keys(attributes).filter(key => key !== 'id');
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...columns.map(key => attributes[key]), attributes.id];

    await db.runAsync(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
      values
    );

    entity._forRepository.updatePersistenceState({
      isDirty: false,
      uncommittedChanges: []
    });
  }

  async delete(entity: T): Promise<void> {
    const attributes = entity._forRepository.getAttributes();
    if (!attributes.id) {
      throw new Error('Cannot delete entity without an id');
    }

    const db = await this.dbManager.getConnection();
    try {
      await db.runAsync(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        [attributes.id]
      );

      entity._forRepository.updatePersistenceState({
        isDeleted: true,
        isDirty: false,
        uncommittedChanges: []
      });
    } finally {
      await this.dbManager.releaseConnection();
    }
  }

  async loadAttribute(entity: T, key: string): Promise<any> {
    const db = await this.dbManager.getConnection();
    try {
      const attributes = entity._forRepository.getAttributes();
      const result = await db.getFirstAsync<Record<string, any>>(
        `SELECT ${key} FROM ${this.tableName} WHERE id = ?`,
        [attributes.id]
      );
      return result ? result[key] : null;
    } finally {
      await this.dbManager.releaseConnection();
    }
  }

  protected abstract createEntity(data: Record<string, any>, isNew?: boolean): T;
}