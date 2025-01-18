import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite/next';
import migrations from '../drizzle/migrations';
import { system } from './powersync/system';

export async function handleMigrations() {
  const db = system.db;
  try {
    await migrate(db, migrations);
    console.log('Migrations completed successfully');
    return { success: true, error: null };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
}