import { eq, and, desc, SQL } from 'drizzle-orm';
import { SQLiteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { db } from '../db/database';

// Common entity type matching our schema structure
export interface BaseEntity {
  id: string;
  rev: number;
  createdAt?: string;
  lastUpdated?: string;
}

// Define the common columns that all our tables will have
export interface BaseTable extends SQLiteTable {
  id: ReturnType<typeof text>;
  rev: ReturnType<typeof integer>;
  createdAt: ReturnType<typeof text>;
  lastUpdated: ReturnType<typeof text>;
}

export abstract class BaseService<
  TTable extends BaseTable,
  TEntity extends BaseEntity
> {
  constructor(protected table: TTable) {}

  async findById(id: string): Promise<TEntity | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id));
    return record as TEntity;
  }

  async findMany(where?: SQL<unknown>): Promise<TEntity[]> {
    const query = db.select().from(this.table);
    if (where) {
      query.where(where);
    }
    return (await query) as TEntity[];
  }

  protected async create(data: Omit<TEntity, keyof BaseEntity>): Promise<TEntity> {
    const [record] = await db
      .insert(this.table)
      .values({
        ...data,
        rev: 1,
      } as any)
      .returning();
    return record as TEntity;
  }

  protected async update(
    id: string, 
    data: Partial<Omit<TEntity, keyof BaseEntity>>
  ): Promise<TEntity> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Record with id ${id} not found`);
    }

    const [record] = await db
      .update(this.table)
      .set({
        ...data,
        rev: existing.rev + 1,
        lastUpdated: new Date().toISOString()
      } as any)
      .where(eq(this.table.id, id))
      .returning();
    return record as TEntity;
  }

  protected async delete(id: string): Promise<void> {
    await db
      .delete(this.table)
      .where(eq(this.table.id, id));
  }

  protected async findOneWhere(where: SQL<unknown>): Promise<TEntity | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(where);
    return record as TEntity;
  }
}