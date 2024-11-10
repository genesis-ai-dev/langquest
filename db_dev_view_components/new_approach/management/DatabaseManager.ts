import * as SQLite from 'expo-sqlite';
import { DB_CONFIG } from './config';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private activeConnection: SQLite.SQLiteDatabase | null = null;
  private connectionCount = 0;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async getConnection(): Promise<SQLite.SQLiteDatabase> {
    if (!this.activeConnection) {
      this.activeConnection = await SQLite.openDatabaseAsync(DB_CONFIG.name, DB_CONFIG.options);
    }
    this.connectionCount++;
    return this.activeConnection;
  }

  async releaseConnection(): Promise<void> {
    this.connectionCount--;
    if (this.connectionCount === 0 && this.activeConnection) {
      await this.activeConnection.closeAsync();
      this.activeConnection = null;
    }
  }
}