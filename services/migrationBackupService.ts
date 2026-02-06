/**
 * Migration Backup Service
 *
 * Handles backing up and restoring the database and local store
 * before/after client-side migrations run.
 *
 * This service is critical for ensuring data safety during migrations:
 * - Creates backups before migrations run
 * - Restores from backup if migrations fail
 * - Cleans up backups after successful migrations
 *
 * Backup Strategy:
 * - SQLite database: Copied to a backup file in documentDirectory (native only)
 * - Local store (AsyncStorage): Serialized to a JSON file
 *
 * The backup files are stored with a timestamp suffix to allow
 * for multiple backup attempts without overwriting.
 *
 * Cross-platform support:
 * - Native: Uses expo-file-system via fileUtils.ts
 * - Web: Uses OPFS (Origin Private File System) via fileUtils.web.ts
 */

import {
  copyFile,
  deleteIfExists,
  ensureDir,
  fileExists,
  getDocumentDirectory,
  readFile,
  writeFile
} from '@/utils/fileUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Constants
const BACKUP_DIR = 'migration_backups';
const DB_FILENAME = 'sqlite.db';
const DB_BACKUP_PREFIX = 'sqlite_backup_';
const LOCAL_STORE_KEY = 'local-store';
const LOCAL_STORE_BACKUP_PREFIX = 'local_store_backup_';

// Types
export interface BackupInfo {
  timestamp: string;
  dbBackupPath: string | null;
  localStoreBackupPath: string | null;
  fromVersion: string;
  toVersion: string;
}

export interface BackupResult {
  success: boolean;
  backupInfo: BackupInfo | null;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  dbRestored: boolean;
  localStoreRestored: boolean;
  error?: string;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Get the path to the migration backups directory
 */
function getBackupDir(): string {
  const docDir = getDocumentDirectory() ?? '';
  return `${docDir}${BACKUP_DIR}/`;
}

/**
 * Get the path to the main database file
 */
function getDbPath(): string {
  const docDir = getDocumentDirectory() ?? '';
  return `${docDir}${DB_FILENAME}`;
}

/**
 * Generate a timestamped backup filename
 */
function generateBackupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Get the path to a database backup file
 */
function getDbBackupPath(timestamp: string): string {
  return `${getBackupDir()}${DB_BACKUP_PREFIX}${timestamp}.db`;
}

/**
 * Get the path to a local store backup file
 */
function getLocalStoreBackupPath(timestamp: string): string {
  return `${getBackupDir()}${LOCAL_STORE_BACKUP_PREFIX}${timestamp}.json`;
}

// ============================================================================
// DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure the backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  const backupDir = getBackupDir();
  try {
    await ensureDir(backupDir);
    console.log(
      '[MigrationBackup] Ensured backup directory exists:',
      backupDir
    );
  } catch (error) {
    console.error('[MigrationBackup] Error creating backup directory:', error);
    throw error;
  }
}

// ============================================================================
// DATABASE BACKUP/RESTORE
// ============================================================================

/**
 * Create a backup of the SQLite database
 */
async function backupDatabase(timestamp: string): Promise<string | null> {
  const dbPath = getDbPath();
  const backupPath = getDbBackupPath(timestamp);

  try {
    // Check if database exists
    const dbExistsNow = await fileExists(dbPath);
    if (!dbExistsNow) {
      console.log('[MigrationBackup] No database file to backup');
      return null;
    }

    // Copy database to backup location
    await copyFile(dbPath, backupPath);

    // Verify backup was created
    const backupExistsNow = await fileExists(backupPath);
    if (!backupExistsNow) {
      throw new Error('Backup file was not created');
    }

    console.log('[MigrationBackup] ✓ Database backed up to:', backupPath);
    return backupPath;
  } catch (error) {
    console.error('[MigrationBackup] Error backing up database:', error);
    throw error;
  }
}

/**
 * Restore the SQLite database from a backup
 */
async function restoreDatabase(backupPath: string): Promise<boolean> {
  const dbPath = getDbPath();

  try {
    // Check if backup exists
    const backupExistsNow = await fileExists(backupPath);
    if (!backupExistsNow) {
      console.error('[MigrationBackup] Backup file not found:', backupPath);
      return false;
    }

    // Delete current database (idempotent - won't throw if doesn't exist)
    await deleteIfExists(dbPath);

    // Copy backup to database location
    await copyFile(backupPath, dbPath);

    // Verify restore was successful
    const dbExistsNow = await fileExists(dbPath);
    if (!dbExistsNow) {
      throw new Error('Database was not restored');
    }

    console.log('[MigrationBackup] ✓ Database restored from:', backupPath);
    return true;
  } catch (error) {
    console.error('[MigrationBackup] Error restoring database:', error);
    throw error;
  }
}

// ============================================================================
// LOCAL STORE BACKUP/RESTORE
// ============================================================================

/**
 * Create a backup of the local store (AsyncStorage)
 */
async function backupLocalStore(timestamp: string): Promise<string | null> {
  const backupPath = getLocalStoreBackupPath(timestamp);

  try {
    // Read current local store data
    const localStoreData = await AsyncStorage.getItem(LOCAL_STORE_KEY);

    if (!localStoreData) {
      console.log('[MigrationBackup] No local store data to backup');
      return null;
    }

    // Write to backup file (writeFile handles directory creation)
    await writeFile(backupPath, localStoreData, { encoding: 'utf8' });

    // Verify backup was created
    const backupExistsNow = await fileExists(backupPath);
    if (!backupExistsNow) {
      throw new Error('Local store backup file was not created');
    }

    console.log('[MigrationBackup] ✓ Local store backed up to:', backupPath);
    return backupPath;
  } catch (error) {
    console.error('[MigrationBackup] Error backing up local store:', error);
    throw error;
  }
}

/**
 * Convert ArrayBuffer to UTF-8 string
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(buffer);
}

/**
 * Restore the local store from a backup
 */
async function restoreLocalStore(backupPath: string): Promise<boolean> {
  try {
    // Check if backup exists
    const backupExistsNow = await fileExists(backupPath);
    if (!backupExistsNow) {
      console.error(
        '[MigrationBackup] Local store backup not found:',
        backupPath
      );
      return false;
    }

    // Read backup data (returns ArrayBuffer)
    const backupBuffer = await readFile(backupPath, { encoding: 'utf8' });
    const backupData = arrayBufferToString(backupBuffer);

    // Validate JSON
    try {
      JSON.parse(backupData);
    } catch {
      console.error('[MigrationBackup] Invalid JSON in local store backup');
      return false;
    }

    // Restore to AsyncStorage
    await AsyncStorage.setItem(LOCAL_STORE_KEY, backupData);

    console.log('[MigrationBackup] ✓ Local store restored from:', backupPath);
    return true;
  } catch (error) {
    console.error('[MigrationBackup] Error restoring local store:', error);
    throw error;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a full backup before running migrations
 * Backs up both the database and local store
 *
 * @param fromVersion - Current schema version
 * @param toVersion - Target schema version
 * @returns BackupResult with backup info
 */
export async function createMigrationBackup(
  fromVersion: string,
  toVersion: string
): Promise<BackupResult> {
  console.log(
    `[MigrationBackup] Creating backup for migration ${fromVersion} → ${toVersion}...`
  );

  try {
    // Ensure backup directory exists
    await ensureBackupDir();

    const timestamp = generateBackupTimestamp();
    let dbBackupPath: string | null = null;
    let localStoreBackupPath: string | null = null;

    // Backup database (native only - web uses different storage)
    if (Platform.OS !== 'web') {
      try {
        dbBackupPath = await backupDatabase(timestamp);
      } catch (error) {
        console.error('[MigrationBackup] Database backup failed:', error);
        // Continue - we still want to backup local store
      }
    }

    // Backup local store
    try {
      localStoreBackupPath = await backupLocalStore(timestamp);
    } catch (error) {
      console.error('[MigrationBackup] Local store backup failed:', error);
      // Continue - we might still have a db backup
    }

    // Check if we got at least one backup
    if (!dbBackupPath && !localStoreBackupPath) {
      console.warn('[MigrationBackup] No data to backup - continuing anyway');
    }

    const backupInfo: BackupInfo = {
      timestamp,
      dbBackupPath,
      localStoreBackupPath,
      fromVersion,
      toVersion
    };

    console.log('[MigrationBackup] ✓ Backup created successfully');
    return {
      success: true,
      backupInfo
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[MigrationBackup] Backup failed:', errorMsg);
    return {
      success: false,
      backupInfo: null,
      error: errorMsg
    };
  }
}

/**
 * Restore from a backup after migration failure
 * Restores both the database and local store
 *
 * @param backupInfo - Backup info from createMigrationBackup
 * @returns RestoreResult with status
 */
export async function restoreFromBackup(
  backupInfo: BackupInfo
): Promise<RestoreResult> {
  console.log(
    `[MigrationBackup] Restoring from backup (${backupInfo.timestamp})...`
  );

  let dbRestored = false;
  let localStoreRestored = false;

  try {
    // Restore database (native only)
    if (backupInfo.dbBackupPath && Platform.OS !== 'web') {
      try {
        dbRestored = await restoreDatabase(backupInfo.dbBackupPath);
      } catch (error) {
        console.error('[MigrationBackup] Database restore failed:', error);
      }
    }

    // Restore local store
    if (backupInfo.localStoreBackupPath) {
      try {
        localStoreRestored = await restoreLocalStore(
          backupInfo.localStoreBackupPath
        );
      } catch (error) {
        console.error('[MigrationBackup] Local store restore failed:', error);
      }
    }

    const success = dbRestored || localStoreRestored;

    if (success) {
      console.log('[MigrationBackup] ✓ Restore completed');
      console.log(`  - Database: ${dbRestored ? 'restored' : 'not restored'}`);
      console.log(
        `  - Local store: ${localStoreRestored ? 'restored' : 'not restored'}`
      );
    } else {
      console.warn('[MigrationBackup] ⚠️ No data was restored');
    }

    return {
      success,
      dbRestored,
      localStoreRestored
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[MigrationBackup] Restore failed:', errorMsg);
    return {
      success: false,
      dbRestored,
      localStoreRestored,
      error: errorMsg
    };
  }
}

/**
 * Read directory contents (platform-specific)
 * Returns empty array on web since OPFS directory listing would require additional setup
 */
async function readBackupDirectory(): Promise<string[]> {
  if (Platform.OS === 'web') {
    // Web OPFS directory listing not implemented - return empty
    // This means cleanup/recovery functions won't work on web,
    // but the core backup/restore functionality will work
    console.log(
      '[MigrationBackup] Directory listing not available on web platform'
    );
    return [];
  }

  // Dynamic import for native platforms
  const FileSystem = await import('expo-file-system');
  const backupDir = getBackupDir();
  const dirInfo = await FileSystem.getInfoAsync(backupDir);

  if (!dirInfo.exists) {
    return [];
  }

  return FileSystem.readDirectoryAsync(backupDir);
}

/**
 * Clean up old backup files after successful migration
 * Keeps only the most recent backup for safety
 *
 * Note: This function only works on native platforms.
 * On web, backups are managed per-session and cleaned up via deleteBackup.
 *
 * @param currentBackupInfo - Current backup to keep (optional)
 */
export async function cleanupOldBackups(
  currentBackupInfo?: BackupInfo
): Promise<void> {
  console.log('[MigrationBackup] Cleaning up old backups...');

  try {
    const files = await readBackupDirectory();

    if (files.length === 0) {
      console.log('[MigrationBackup] No backup files to clean');
      return;
    }

    // Filter out current backup files
    const currentFiles = new Set<string>();
    if (currentBackupInfo) {
      if (currentBackupInfo.dbBackupPath) {
        const dbFilename = currentBackupInfo.dbBackupPath.split('/').pop();
        if (dbFilename) currentFiles.add(dbFilename);
      }
      if (currentBackupInfo.localStoreBackupPath) {
        const storeFilename = currentBackupInfo.localStoreBackupPath
          .split('/')
          .pop();
        if (storeFilename) currentFiles.add(storeFilename);
      }
    }

    // Delete old backup files (keep current)
    const backupDir = getBackupDir();
    let deletedCount = 0;
    for (const file of files) {
      if (currentFiles.has(file)) {
        continue; // Keep current backup
      }

      // Check if it's a backup file
      if (
        file.startsWith(DB_BACKUP_PREFIX) ||
        file.startsWith(LOCAL_STORE_BACKUP_PREFIX)
      ) {
        try {
          await deleteIfExists(`${backupDir}${file}`);
          deletedCount++;
        } catch (error) {
          console.warn(
            `[MigrationBackup] Failed to delete old backup: ${file}`,
            error
          );
        }
      }
    }

    console.log(`[MigrationBackup] ✓ Cleaned up ${deletedCount} old backup(s)`);
  } catch (error) {
    console.warn('[MigrationBackup] Error cleaning up backups:', error);
    // Don't throw - cleanup failure shouldn't break the app
  }
}

/**
 * Delete the current backup after successful migration
 * This should be called after migration completes successfully
 *
 * @param backupInfo - Backup info to delete
 */
export async function deleteBackup(backupInfo: BackupInfo): Promise<void> {
  console.log('[MigrationBackup] Deleting backup files...');

  try {
    if (backupInfo.dbBackupPath) {
      await deleteIfExists(backupInfo.dbBackupPath);
      console.log('[MigrationBackup] ✓ Deleted database backup');
    }

    if (backupInfo.localStoreBackupPath) {
      await deleteIfExists(backupInfo.localStoreBackupPath);
      console.log('[MigrationBackup] ✓ Deleted local store backup');
    }
  } catch (error) {
    console.warn('[MigrationBackup] Error deleting backup:', error);
    // Don't throw - deletion failure shouldn't break the app
  }
}

/**
 * Check if a backup exists and is valid
 *
 * Note: On web, this always returns false since directory listing
 * is not available. Use the BackupInfo returned from createMigrationBackup instead.
 */
export async function hasValidBackup(): Promise<boolean> {
  try {
    const files = await readBackupDirectory();

    if (files.length === 0) {
      return false;
    }

    const hasDbBackup = files.some((f) => f.startsWith(DB_BACKUP_PREFIX));
    const hasStoreBackup = files.some((f) =>
      f.startsWith(LOCAL_STORE_BACKUP_PREFIX)
    );

    return hasDbBackup || hasStoreBackup;
  } catch {
    return false;
  }
}

/**
 * Get the most recent backup info if available
 * Useful for recovering from crashed migrations
 *
 * Note: On web, this always returns null since directory listing
 * is not available. Use the BackupInfo returned from createMigrationBackup instead.
 */
export async function getMostRecentBackup(): Promise<BackupInfo | null> {
  try {
    const files = await readBackupDirectory();

    if (files.length === 0) {
      return null;
    }

    const backupDir = getBackupDir();

    // Find the most recent db backup
    const dbBackups = files
      .filter((f) => f.startsWith(DB_BACKUP_PREFIX))
      .sort()
      .reverse();

    // Find the most recent local store backup
    const storeBackups = files
      .filter((f) => f.startsWith(LOCAL_STORE_BACKUP_PREFIX))
      .sort()
      .reverse();

    if (dbBackups.length === 0 && storeBackups.length === 0) {
      return null;
    }

    // Extract timestamp from most recent backup
    let timestamp = '';
    if (dbBackups[0]) {
      timestamp = dbBackups[0].replace(DB_BACKUP_PREFIX, '').replace('.db', '');
    } else if (storeBackups[0]) {
      timestamp = storeBackups[0]
        .replace(LOCAL_STORE_BACKUP_PREFIX, '')
        .replace('.json', '');
    }

    return {
      timestamp,
      dbBackupPath: dbBackups[0] ? `${backupDir}${dbBackups[0]}` : null,
      localStoreBackupPath: storeBackups[0]
        ? `${backupDir}${storeBackups[0]}`
        : null,
      fromVersion: 'unknown',
      toVersion: 'unknown'
    };
  } catch (error) {
    console.error('[MigrationBackup] Error getting recent backup:', error);
    return null;
  }
}
