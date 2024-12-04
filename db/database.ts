import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from "expo-sqlite";
import * as schema from './drizzleSchema';

// Create a singleton database instance
class Database {
  private static instance: ReturnType<typeof drizzle>;

  static getInstance() {
    if (!this.instance) {
      const expo = openDatabaseSync('db.db', {
        enableChangeListener: true
      });
      this.instance = drizzle(expo, { schema });
    }
    return this.instance;
  }
}

export const db__ = Database.getInstance();