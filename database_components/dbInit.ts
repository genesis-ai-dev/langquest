import * as SQLite from 'expo-sqlite';
import { schemaSQL } from '@/utils/schema';

const DB_NAME = 'langquest.db';

export async function initDatabase(forceReset: boolean = false): Promise<void> {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME, {
        enableChangeListener: true,
      });
  
      console.log('Database opened successfully');
  
      if (forceReset) {
        // Drop all existing tables and triggers
        const objects = await db.getAllAsync<{ name: string, type: string }>(
          "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger') AND name NOT LIKE 'sqlite_%'"
        );
        
        for (const obj of objects) {
          await db.execAsync(`DROP ${obj.type} IF EXISTS ${obj.name}`);
          console.log(`Dropped ${obj.type}: ${obj.name}`);
        }
        
        // Execute each statement separately instead of all at once
        const statements = schemaSQL
          .split(/;\s*(?=CREATE)/i)  // Split on semicolon followed by CREATE
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);
      
        for (const stmt of statements) {
          try {
            // Add semicolon back and execute each statement individually
            await db.execAsync(stmt + ';');
            console.log('Executed statement:', stmt.split('\n')[0]); // Log first line for debugging
          } catch (error) {
            console.error('Failed statement:', stmt);
            throw error;
          }
        }
        
        console.log('Schema recreated from scratch');
      } else {
        // Get all existing tables
        const existingTables = await db.getAllAsync<{ name: string, sql: string }>(
          "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
  
        // Extract table creation statements from schemaSQL
        const schemaTableStatements = schemaSQL.match(/CREATE TABLE.*?;/gs) || [];
  
        for (const tableStatement of schemaTableStatements) {
          const tableName = tableStatement.match(/CREATE TABLE (\w+)/)?.[1];
          if (!tableName) continue;
  
          const existingTable = existingTables.find(t => t.name === tableName);
  
          if (existingTable) {
            const existingSQL = existingTable.sql.replace(/\s+/g, '').toLowerCase();
            const schemaSQL = tableStatement.replace(/\s+/g, '').toLowerCase().replace(/;$/, '');
            
            if (existingSQL !== schemaSQL) {
              console.log(`Difference found for table ${tableName}`);
              await db.execAsync(`DROP TABLE ${tableName}`);
              await db.execAsync(tableStatement);
              console.log(`Recreated table: ${tableName}`);
            }
          } else {
            await db.execAsync(tableStatement);
            console.log(`Created new table: ${tableName}`);
          }
        }
      }
  
      // Enable WAL mode for better performance
      await db.execAsync('PRAGMA journal_mode = WAL');
      await db.execAsync('PRAGMA foreign_keys = ON');
  
      await db.closeAsync();
      console.log('Database closed successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }