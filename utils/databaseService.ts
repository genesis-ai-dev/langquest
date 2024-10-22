import * as SQLite from 'expo-sqlite';
import { schemaSQL } from './schema';

const DB_NAME = 'langquest.db';

export async function initDatabase(): Promise<void> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME, {
      enableChangeListener: true,
    });

    console.log('Database opened successfully');

    // Get all existing tables
    const existingTables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const existingTableNames = existingTables.map(t => t.name);

    // Define expected tables (extract table names from schemaSQL)
    const expectedTables = schemaSQL.match(/CREATE TABLE (\w+)/g)?.map(match => match.split(' ')[2]) || [];

    // Remove tables that aren't in the schema
    for (const tableName of existingTableNames) {
      if (!expectedTables.includes(tableName)) {
        await db.execAsync(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`Dropped table: ${tableName}`);
      }
    }

    // Create tables that don't exist
    for (const tableName of expectedTables) {
      if (!existingTableNames.includes(tableName)) {
        const tableSchema = schemaSQL.match(new RegExp(`CREATE TABLE ${tableName}[\\s\\S]*?;`))?.[0];
        if (tableSchema) {
          await db.execAsync(tableSchema);
          console.log(`Created table: ${tableName}`);
        }
      }
    }

    // Check the tables after initialization
    const finalTables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    console.log('Final tables:', finalTables.map(t => t.name));

    // Enable WAL mode for better performance
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA foreign_keys = ON');

    // Close the database
    await db.closeAsync();
    console.log('Database closed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Add other database-related functions here as needed