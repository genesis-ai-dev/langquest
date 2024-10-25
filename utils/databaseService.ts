import * as SQLite from 'expo-sqlite';
import { schemaSQL } from './schema';
import * as Crypto from 'expo-crypto';

export interface Language {
  id: string;
  rev: number;
  nativeName: string;
  englishName: string;
  iso639_3: string | null;
  uiReady: boolean;
  creator: string;
  versionNum: number;
  versionChainId: string;
}

export interface User {
  id: string;
  rev: number;
  username: string;
  uiLanguage: string;
  password?: string;
  versionNum: number;
  versionChainId: string;
}

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

// ---------------------------------------
// -------------  Languages  -------------
// ---------------------------------------

export async function getAllLanguages(): Promise<Language[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(
    'SELECT * FROM Language ORDER BY englishName'
  );
  
  try {
    const result = await statement.executeAsync();
    const languages = await result.getAllAsync() as Language[];
    return languages;
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function getAllLatestLanguages(): Promise<Language[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(`
    SELECT l1.* 
    FROM Language l1
    INNER JOIN (
      SELECT versionChainId, MAX(versionNum) as maxVersion
      FROM Language
      GROUP BY versionChainId
    ) l2 
    ON l1.versionChainId = l2.versionChainId 
    AND l1.versionNum = l2.maxVersion
    ORDER BY englishName
  `);
  
  try {
    const result = await statement.executeAsync();
    return await result.getAllAsync() as Language[];
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function addLanguage(language: Omit<Language, 'id' | 'rev' | 'versionNum' | 'versionChainId'>): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Insert the language and get the ID
  const statement = await db.prepareAsync(
    `INSERT INTO Language (
      rev, 
      nativeName, 
      englishName, 
      iso639_3, 
      uiReady, 
      creator,
      versionNum, 
      versionChainId
    ) VALUES (
      1, 
      $nativeName, 
      $englishName, 
      $iso639_3, 
      $uiReady, 
      $creator,
      1, 
      (SELECT last_insert_rowid())
    )
    RETURNING id`
  );

  try {
    const result = await statement.executeAsync({
      $nativeName: language.nativeName,
      $englishName: language.englishName,
      $iso639_3: language.iso639_3,
      $uiReady: language.uiReady ? 1 : 0,
      $creator: language.creator
    });
    const newLanguage = await result.getFirstAsync() as { id: string };
    
    // Update the versionChainId to match the id
    const updateChainStatement = await db.prepareAsync(
      'UPDATE Language SET versionChainId = $id WHERE id = $id'
    );
    
    try {
      await updateChainStatement.executeAsync({ $id: newLanguage.id });
    } finally {
      await updateChainStatement.finalizeAsync();
    }
    
    return newLanguage?.id || '';
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function getLanguageVersions(versionChainId: string): Promise<Language[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  let statement;
  try {
    // Update the SELECT to explicitly include creator
    statement = await db.prepareAsync(
      'SELECT id, rev, nativeName, englishName, iso639_3, uiReady, creator, versionNum, versionChainId, createdAt, lastUpdated FROM Language WHERE versionChainId = $chainId ORDER BY versionNum DESC'
    );
    const result = await statement.executeAsync({ $chainId: versionChainId });
    return await result.getAllAsync() as Language[];
  } finally {
    if (statement) {
      await statement.finalizeAsync();
    }
    await db.closeAsync();
  }
}

export async function updateLanguage(language: Language): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // According to docs, runAsync is preferred for simple UPDATE operations
      await txn.runAsync(`
        UPDATE Language SET 
          rev = rev + 1,
          nativeName = $nativeName,
          englishName = $englishName,
          iso639_3 = $iso639_3,
          uiReady = $uiReady,
          creator = $creator
        WHERE id = $id
      `, {
        $id: language.id,
        $nativeName: language.nativeName,
        $englishName: language.englishName,
        $iso639_3: language.iso639_3,
        $uiReady: language.uiReady ? 1 : 0,
        $creator: language.creator
      });
    });
  } finally {
    await db.closeAsync();
  }
}

export async function addLanguageVersion(
  baseLanguage: Language,
  updates: Partial<Language>
): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    let newId = '';
    await db.withExclusiveTransactionAsync(async (txn) => {
      const insertStatement = await txn.prepareAsync(`
        INSERT INTO Language (
          rev, nativeName, englishName, iso639_3, uiReady, creator,
          versionNum, versionChainId
        ) VALUES (
          1, $nativeName, $englishName, $iso639_3, $uiReady, $creator,
          $versionNum, $versionChainId
        )
        RETURNING id
      `);

      try {
        const result = await insertStatement.executeAsync({
          $nativeName: updates.nativeName ?? baseLanguage.nativeName,
          $englishName: updates.englishName ?? baseLanguage.englishName,
          $iso639_3: updates.iso639_3 ?? baseLanguage.iso639_3,
          $uiReady: (updates.uiReady ?? baseLanguage.uiReady) ? 1 : 0,
          $creator: baseLanguage.creator,
          $versionNum: baseLanguage.versionNum + 1,
          $versionChainId: baseLanguage.versionChainId
        });
        const row = await result.getFirstAsync() as { id: string };
        newId = row?.id || '';
      } finally {
        await insertStatement.finalizeAsync();
      }
    });
    return newId;
  } finally {
    await db.closeAsync();
  }
}

export async function deleteLanguage(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Check dependencies with a single query
      const result = await txn.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM (
          SELECT uiLanguage FROM User WHERE uiLanguage = $id
          UNION ALL
          SELECT sourceLanguage FROM Project WHERE sourceLanguage = $id
          UNION ALL
          SELECT targetLanguage FROM Project WHERE targetLanguage = $id
        )
      `, { $id: id });
      
      const count = result?.count ?? 0; // Handle both null and undefined
      if (count > 0) {
        throw new Error('Language is in use and cannot be deleted');
      }

      // Delete the language
      await txn.runAsync('DELETE FROM Language WHERE id = $id', { $id: id });
    });
  } finally {
    await db.closeAsync();
  }
}

export async function getLanguageByEnglishName(englishName: string): Promise<Language | null> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(
    'SELECT * FROM Language WHERE englishName = $englishName'
  );
  
  try {
    const result = await statement.executeAsync({ $englishName: englishName });
    const language = await result.getFirstAsync() as Language | null;
    return language;
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function getAllUiReadyLanguages(): Promise<Language[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(`
    SELECT l1.* 
    FROM Language l1
    INNER JOIN (
      SELECT versionChainId, MAX(versionNum) as maxVersion
      FROM Language
      GROUP BY versionChainId
    ) l2 
    ON l1.versionChainId = l2.versionChainId 
    AND l1.versionNum = l2.maxVersion
    WHERE l1.uiReady = 1
    ORDER BY l1.nativeName
  `);
  
  try {
    const result = await statement.executeAsync();
    return await result.getAllAsync() as Language[];
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

// ---------------------------------------
// ---------------  Users  ---------------
// ---------------------------------------

export async function validateUser(username: string, password: string): Promise<boolean> {
  let db;
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Get the latest version of the user with this username
    const userRecord = await db.getFirstAsync<{ 
      password: string 
    }>(`
      SELECT u1.password
      FROM User u1
      INNER JOIN (
        SELECT versionChainId, MAX(versionNum) as maxVersion
        FROM User
        WHERE username = ?
        GROUP BY versionChainId
      ) u2 
      ON u1.versionChainId = u2.versionChainId 
      AND u1.versionNum = u2.maxVersion
    `, [username]);

    if (!userRecord) {
      return false;
    }

    // Verify password
    const hashedPassword = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    return hashedPassword === userRecord.password;

  } finally {
    if (db) {
      await db.closeAsync();
    }
  }
}

export async function getAllUsers(): Promise<User[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(
    'SELECT id, rev, username, uiLanguage FROM User ORDER BY username'
  );
  
  try {
    const result = await statement.executeAsync();
    const users = await result.getAllAsync() as User[];
    return users;
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function getAllLatestUsers(): Promise<User[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(`
    SELECT u1.* 
    FROM User u1
    INNER JOIN (
      SELECT versionChainId, MAX(versionNum) as maxVersion
      FROM User
      GROUP BY versionChainId
    ) u2 
    ON u1.versionChainId = u2.versionChainId 
    AND u1.versionNum = u2.maxVersion
    ORDER BY username
  `);
  
  try {
    const result = await statement.executeAsync();
    return await result.getAllAsync() as User[];
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function addUser(
  username: string, 
  password: string, 
  uiLanguage: string
): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Hash the password
  const hashedPassword = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );

  // Insert the user and get the ID
  const insertStatement = await db.prepareAsync(
    `INSERT INTO User (
      rev, 
      username, 
      password, 
      uiLanguage,
      versionNum,
      versionChainId
    ) 
    VALUES (
      1, 
      $username, 
      $password, 
      $uiLanguage,
      1,
      (SELECT last_insert_rowid())
    )
    RETURNING id`
  );

  try {
    const result = await insertStatement.executeAsync({
      $username: username,
      $password: hashedPassword,
      $uiLanguage: uiLanguage
    });
    const newUser = await result.getFirstAsync() as { id: string };
    
    // Update the versionChainId to match the id
    const updateChainStatement = await db.prepareAsync(
      'UPDATE User SET versionChainId = $id WHERE id = $id'
    );
    
    try {
      await updateChainStatement.executeAsync({ $id: newUser.id });
    } finally {
      await updateChainStatement.finalizeAsync();
    }
    
    return newUser?.id || '';
  } finally {
    await insertStatement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function getUserVersions(versionChainId: string): Promise<User[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  let statement;
  try {
    statement = await db.prepareAsync(
      'SELECT id, rev, username, uiLanguage, versionNum, versionChainId, createdAt, lastUpdated FROM User WHERE versionChainId = $chainId ORDER BY versionNum DESC'
    );
    const result = await statement.executeAsync({ $chainId: versionChainId });
    return await result.getAllAsync() as User[];
  } finally {
    if (statement) {
      await statement.finalizeAsync();
    }
    await db.closeAsync();
  }
}

export async function updateUser(user: User): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // According to docs, runAsync is preferred for simple UPDATE operations
      await txn.runAsync(`
        UPDATE User SET 
          rev = rev + 1,
          username = $username,
          uiLanguage = $uiLanguage
        WHERE id = $id
      `, {
        $id: user.id,
        $username: user.username,
        $uiLanguage: user.uiLanguage
      });
    });
  } finally {
    await db.closeAsync();
  }
}

export async function addUserVersion(
  baseUser: User,
  updates: Partial<User>,
  newPassword?: string,
  requireOldPassword: boolean = true,
  oldPassword?: string
): Promise<string> {
  console.log('Starting addUserVersion with newPassword:', newPassword ? '[PROVIDED]' : '[NOT PROVIDED]');
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    let newId = '';
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Get the previous version's password
      const statement = await txn.prepareAsync(`
        SELECT password 
        FROM User 
        WHERE versionChainId = $chainId 
        ORDER BY versionNum DESC
        LIMIT 1
      `);
      
      let existingPassword: string;
      try {
        const result = await statement.executeAsync({ 
          $chainId: baseUser.versionChainId as string
        });
        const user = await result.getFirstAsync() as { password: string } | null;

        if (!user?.password) {
          throw new Error('Previous version password not found');
        }
        existingPassword = user.password;

        // If new password provided and verification required, verify old password
        if (newPassword && requireOldPassword) {
          if (!oldPassword) {
            throw new Error('Old password required for password change');
          }
          const hashedOldPassword = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            oldPassword
          );
          if (hashedOldPassword !== existingPassword) {
            throw new Error('Invalid old password');
          }
        }

        // Get the next version number
        const versionStatement = await txn.prepareAsync(
          'SELECT MAX(versionNum) as maxVersion FROM User WHERE versionChainId = $chainId'
        );
        try {
          const result = await versionStatement.executeAsync({ 
            $chainId: baseUser.versionChainId as string 
          });
          const versionRow = await result.getFirstAsync() as { maxVersion: number };
          const nextVersion = (versionRow?.maxVersion || 0) + 1;

          // Insert the new version
          const insertStatement = await txn.prepareAsync(`
            INSERT INTO User (
              rev, username, password, uiLanguage,
              versionNum, versionChainId
            ) VALUES (
              1, $username, $password, $uiLanguage,
              $versionNum, $versionChainId
            )
            RETURNING id
          `);

          try {
            // If new password provided, hash it. Otherwise use existing password
            const passwordToUse = newPassword 
              ? await Crypto.digestStringAsync(
                  Crypto.CryptoDigestAlgorithm.SHA256,
                  newPassword
                )
              : existingPassword;

              console.log('Using password:', passwordToUse ? '[HASHED VALUE EXISTS]' : '[NO PASSWORD]');

            const insertResult = await insertStatement.executeAsync({
              $username: (updates.username || baseUser.username) as string,
              $password: passwordToUse,
              $uiLanguage: (updates.uiLanguage || baseUser.uiLanguage) as string,
              $versionNum: nextVersion as number,
              $versionChainId: baseUser.versionChainId as string
            });
            const newRow = await insertResult.getFirstAsync() as { id: string };
            newId = newRow?.id || '';
          } finally {
            await insertStatement.finalizeAsync();
          }
        } finally {
          await versionStatement.finalizeAsync();
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
    
    return newId;
  } finally {
    await db.closeAsync();
  }
}

export async function deleteUser(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Check dependencies
      const result = await txn.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM Language 
        WHERE creator = (SELECT username FROM User WHERE id = $id)
      `, { $id: id });
      
      const count = result?.count ?? 0; // Handle both null and undefined
      if (count > 0) {
        throw new Error('User has created languages and cannot be deleted');
      }

      // Delete the user
      await txn.runAsync('DELETE FROM User WHERE id = $id', { $id: id });
    });
  } finally {
    await db.closeAsync();
  }
}