import * as SQLite from 'expo-sqlite';
import { schemaSQL } from './schema';
import * as Crypto from 'expo-crypto';

const DB_NAME = 'langquest.db';
const SALT_ROUNDS = 10; // Adjust this for stronger hashing

export async function initDatabase(): Promise<void> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME, {
      enableChangeListener: true,
    });

    console.log('Database opened successfully');

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
        // Compare existing table structure with schema
        const existingSQL = existingTable.sql.replace(/\s+/g, '').toLowerCase();
        const schemaSQL = tableStatement.replace(/\s+/g, '').toLowerCase().replace(/;$/, '');
        
        if (existingSQL !== schemaSQL) {
          console.log(`Difference found for table ${tableName}:`);
          console.log('Existing SQL:', existingSQL);
          console.log('Schema SQL:', schemaSQL);
          
          // Table structure is different, drop and recreate
          await db.execAsync(`DROP TABLE ${tableName}`);
          await db.execAsync(tableStatement);
          console.log(`Recreated table: ${tableName}`);
        } else {
          console.log(`Table ${tableName} is up to date`);
        }
      }
    }

    // Remove tables that aren't in the schema
    for (const existingTable of existingTables) {
      if (!schemaTableStatements.some(stmt => stmt.includes(`CREATE TABLE ${existingTable.name}`))) {
        await db.execAsync(`DROP TABLE ${existingTable.name}`);
        console.log(`Dropped table: ${existingTable.name}`);
      }
    }

    // Enable WAL mode for better performance
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA foreign_keys = ON');

    // Check the tables after initialization
    const finalTables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    console.log('Final tables:', finalTables.map(t => t.name));

    await db.closeAsync();
    console.log('Database closed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}


export async function addUser(username: string, password: string, uiLanguage: string): Promise<string | null> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Hash the password using SHA-256
    const hashedPassword = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    
    const result = await db.runAsync(
      'INSERT INTO User (rev, username, password, versionNum, uiLanguage) VALUES (?, ?, ?, ?, ?)',
      1, username, hashedPassword, 1, uiLanguage
    );

    await db.closeAsync();

    if (result.lastInsertRowId) {
      return result.lastInsertRowId.toString();
    }
    return null;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

export async function getAllUsers(): Promise<Array<{ username: string, password: string }>> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    const users = await db.getAllAsync<{ username: string, password: string }>(
      'SELECT username, password FROM User'
    );

    await db.closeAsync();

    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function validateUser(username: string, password: string): Promise<boolean> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    const result = await db.getFirstAsync<{ password: string }>(
      'SELECT password FROM User WHERE username = ?',
      [username]
    );

    await db.closeAsync();

    if (!result) {
      return false;
    }

    // Hash the provided password and compare with stored hash
    const hashedPassword = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    return hashedPassword === result.password;
  } catch (error) {
    console.error('Error validating user:', error);
    throw error;
  }
}