import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDatabase() {
  db = await SQLite.openDatabaseAsync('langquest.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
    INSERT OR IGNORE INTO users (username, password) VALUES ('testuser', 'password123');
  `);

  console.log('Database initialized successfully');
}

export async function authenticateUser(username: string, password: string): Promise<boolean> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE username = ? AND password = ?',
    [username, password]
  );
  return result !== null && result.count > 0;
}