import { eq, and, desc, SQL } from 'drizzle-orm';
// import { SQLiteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { db } from '../db/database';
import { SQLiteTable, TableConfig } from 'drizzle-orm/sqlite-core';
import { BaseSelect, BaseInsert } from './types';
import { DrizzleTable, BaseTableColumns } from './tableTypes';

export abstract class BaseService<
  TTable extends DrizzleTable<BaseTableColumns>,
  TSelect extends BaseSelect,
  TInsert extends BaseInsert
> {
  constructor(protected table: TTable) {}

  async findById(id: string): Promise<TSelect | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id));
    return record as TSelect;
  }

  async findMany(where?: SQL<unknown>): Promise<TSelect[]> {
    const query = db.select().from(this.table);
    if (where) {
      query.where(where);
    }
    return (await query) as TSelect[];
  }

  protected async create(data: TInsert): Promise<TSelect> {
    const [record] = await db
      .insert(this.table)
      .values({
        ...data,
        rev: 1,
      } as TInsert)
      .returning();
    return record as TSelect;
  }

  protected async update(id: string, data: Partial<TInsert>): Promise<TSelect> {
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
    return record as TSelect;
  }

  protected async delete(id: string): Promise<void> {
    await db
      .delete(this.table)
      .where(eq(this.table.id, id));
  }

  protected async findOneWhere(where: SQL<unknown>): Promise<TSelect | undefined> {
    const [record] = await db
      .select()
      .from(this.table)
      .where(where);
    return record as TSelect;
  }
}