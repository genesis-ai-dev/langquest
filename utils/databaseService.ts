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
      
      // Split the schema into statements, properly handling comments and empty lines
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => {
          // Remove comments and empty lines
          const lines = stmt
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('--'));
          return lines.length > 0;
        })
        .map(stmt => {
          // Remove any inline comments and ensure proper formatting
          return stmt
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('--'))
            .join('\n');
        });
    
      // Execute each valid statement
      for (const stmt of statements) {
        try {
          await db.execAsync(stmt + ';');
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

// Add these functions after the existing ones
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
  
  // Start a transaction for updating
  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `UPDATE Language SET 
        rev = rev + 1,
        nativeName = $nativeName,
        englishName = $englishName,
        iso639_3 = $iso639_3,
        uiReady = $uiReady,
        creator = $creator
      WHERE id = $id`  // Add creator to the UPDATE statement
    );

    try {
      await statement.executeAsync({
        $id: language.id,
        $nativeName: language.nativeName,
        $englishName: language.englishName,
        $iso639_3: language.iso639_3,
        $uiReady: language.uiReady ? 1 : 0,
        $creator: language.creator
      });
    } finally {
      await statement.finalizeAsync();
    }
  });

  await db.closeAsync();
}

export async function addLanguageVersion(
  baseLanguage: Language,
  updates: Partial<Language>
): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  const insertStatement = await db.prepareAsync(`
    INSERT INTO Language (
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
      $versionNum, 
      $versionChainId
    )
    RETURNING id
  `);

  try {
    const result = await insertStatement.executeAsync({
      $nativeName: updates.nativeName || baseLanguage.nativeName,
      $englishName: updates.englishName || baseLanguage.englishName,
      $iso639_3: updates.iso639_3 ?? baseLanguage.iso639_3,
      $uiReady: (updates.uiReady ?? baseLanguage.uiReady) ? 1 : 0,
      $creator: baseLanguage.creator,
      $versionNum: baseLanguage.versionNum + 1,
      $versionChainId: baseLanguage.versionChainId
    });
    return (await result.getFirstAsync() as { id: string })?.id || '';
  } finally {
    await insertStatement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function deleteLanguage(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await db.withTransactionAsync(async () => {
    const checkStatement = await db.prepareAsync(
      `SELECT COUNT(*) as count FROM User WHERE uiLanguage = $id
       UNION ALL
       SELECT COUNT(*) FROM Project WHERE sourceLanguage = $id OR targetLanguage = $id`
    );

    try {
      const result = await checkStatement.executeAsync({ $id: id });
      const counts = await result.getAllAsync() as Array<{ count: number }>;
      
      if (counts.some(c => (c as { count: number }).count > 0)) {
        throw new Error('Language is in use and cannot be deleted');
      }
    } finally {
      await checkStatement.finalizeAsync();
    }

    const deleteStatement = await db.prepareAsync(
      'DELETE FROM Language WHERE id = $id'
    );

    try {
      await deleteStatement.executeAsync({ $id: id });
    } finally {
      await deleteStatement.finalizeAsync();
    }
  });

  await db.closeAsync();
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

export type UserWithDetails = User & { uiLanguageName: string };

export async function getAllLatestUsersWithDetails(): Promise<UserWithDetails[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    const statement = await db.prepareAsync(`
      SELECT 
        u.*,
        l.englishName as uiLanguageName
      FROM User u
      LEFT JOIN Language l ON u.uiLanguage = l.id
      WHERE u.id IN (
        SELECT id FROM User u2 
        WHERE u2.versionChainId = u.versionChainId 
        GROUP BY u2.versionChainId 
        HAVING u2.versionNum = MAX(u2.versionNum)
      )
    `);
    
    const result = await statement.executeAsync();
    return await result.getAllAsync() as UserWithDetails[];
  } finally {
    await db.closeAsync();
  }
}

export async function addUser(
  username: string, 
  password: string, 
  uiLanguage: string
): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Check if username already exists
  const checkStatement = await db.prepareAsync(
    'SELECT COUNT(*) as count FROM User WHERE username = $username'
  );

  try {
    const result = await checkStatement.executeAsync({ $username: username });
    const count = await result.getFirstAsync() as { count: number };
    
    if (count.count > 0) {
      throw new Error('Username already exists');
    }
  } finally {
    await checkStatement.finalizeAsync();
  }

  // Hash the password
  const hashedPassword = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );

  // First insert the user and get the ID
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
  const statement = await db.prepareAsync(
    'SELECT * FROM User WHERE versionChainId = $chainId ORDER BY versionNum DESC'
  );
  
  try {
    const result = await statement.executeAsync({ $chainId: versionChainId });
    return await result.getAllAsync() as User[];
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function updateUser(user: User): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const statement = await db.prepareAsync(
    `UPDATE User SET 
      rev = rev + 1,
      username = $username,
      uiLanguage = $uiLanguage
    WHERE id = $id`
  );

  try {
    await statement.executeAsync({
      $id: user.id,
      $username: user.username,
      $uiLanguage: user.uiLanguage
    });
  } finally {
    await statement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function addUserVersion(
  baseUser: User,
  updates: Partial<User>
): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  const insertStatement = await db.prepareAsync(`
    INSERT INTO User (
      rev, 
      username, 
      password, 
      uiLanguage,
      versionNum, 
      versionChainId
    ) VALUES (
      1,
      $username,
      $password,
      $uiLanguage,
      $versionNum,
      $versionChainId
    )
    RETURNING id
  `);

  try {
    // Ensure all values are defined before passing to executeAsync
    const params = {
      $username: updates.username || baseUser.username,
      $password: baseUser.password || '', // Provide default empty string
      $uiLanguage: updates.uiLanguage || baseUser.uiLanguage,
      $versionNum: (baseUser.versionNum + 1) as number,
      $versionChainId: baseUser.versionChainId
    } as const; // Use const assertion to ensure type safety

    const result = await insertStatement.executeAsync(params);
    const newUser = await result.getFirstAsync() as { id: string };
    return newUser?.id || '';
  } finally {
    await insertStatement.finalizeAsync();
    await db.closeAsync();
  }
}

export async function deleteUser(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await db.withTransactionAsync(async () => {
    // Check if user has any dependencies before deletion
    const checkStatement = await db.prepareAsync(
      `SELECT COUNT(*) as count FROM Language WHERE creator = (
        SELECT username FROM User WHERE id = $id
      )`
    );

    try {
      const result = await checkStatement.executeAsync({ $id: id });
      const count = await result.getFirstAsync() as { count: number };
      
      if (count.count > 0) {
        throw new Error('User has created languages and cannot be deleted');
      }
    } finally {
      await checkStatement.finalizeAsync();
    }

    const deleteStatement = await db.prepareAsync(
      'DELETE FROM User WHERE id = $id'
    );

    try {
      await deleteStatement.executeAsync({ $id: id });
    } finally {
      await deleteStatement.finalizeAsync();
    }
  });

  await db.closeAsync();
}