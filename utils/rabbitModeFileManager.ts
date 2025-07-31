import * as FileSystem from 'expo-file-system';

export class RabbitModeFileManager {
    private static baseDir = `${FileSystem.documentDirectory}rabbit-mode-sessions/`;

    /**
     * Ensure the base directory exists for rabbit mode sessions
     */
    static async ensureBaseDirectory(): Promise<void> {
        try {
            const dirInfo = await FileSystem.getInfoAsync(this.baseDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
                console.log('📁 Created rabbit mode base directory:', this.baseDir);
            }
        } catch (error) {
            console.error('❌ Error creating base directory:', error);
            throw error;
        }
    }

    /**
     * Save an audio segment to semi-permanent storage
     * @param sessionId - The rabbit mode session ID
     * @param tempUri - Temporary URI from the recording
     * @returns Permanent URI for the saved file
     */
    static async saveAudioSegment(sessionId: string, tempUri: string): Promise<string> {
        await this.ensureBaseDirectory();

        try {
            const sessionDir = `${this.baseDir}${sessionId}/`;

            // Create session directory if it doesn't exist
            const sessionDirInfo = await FileSystem.getInfoAsync(sessionDir);
            if (!sessionDirInfo.exists) {
                await FileSystem.makeDirectoryAsync(sessionDir, { intermediates: true });
                console.log('📁 Created session directory:', sessionDir);
            }

            const timestamp = Date.now();
            const extension = tempUri.split('.').pop() || 'm4a';
            const permanentUri = `${sessionDir}segment_${timestamp}.${extension}`;

            // Move from temp location to semi-permanent location
            await FileSystem.moveAsync({
                from: tempUri,
                to: permanentUri
            });

            console.log('💾 Audio segment saved:', permanentUri);
            return permanentUri;
        } catch (error) {
            console.error('❌ Error saving audio segment:', error);
            throw error;
        }
    }

    /**
     * Delete all files for a specific session
     * @param sessionId - The session ID to delete files for
     */
    static async deleteSessionFiles(sessionId: string): Promise<void> {
        try {
            const sessionDir = `${this.baseDir}${sessionId}/`;
            const dirInfo = await FileSystem.getInfoAsync(sessionDir);

            if (dirInfo.exists) {
                await FileSystem.deleteAsync(sessionDir, { idempotent: true });
                console.log('🗑️ Deleted session files:', sessionDir);
            } else {
                console.log('ℹ️ Session directory already deleted:', sessionDir);
            }
        } catch (error) {
            console.error('❌ Error deleting session files:', error);
            throw error;
        }
    }

    /**
     * Get all session directory names
     * @returns Array of session IDs that have file directories
     */
    static async getAllSessionDirectories(): Promise<string[]> {
        try {
            await this.ensureBaseDirectory();
            const dirContents = await FileSystem.readDirectoryAsync(this.baseDir);

            // Filter to only directories (session IDs)
            const sessionDirs: string[] = [];
            for (const item of dirContents) {
                const itemPath = `${this.baseDir}${item}`;
                const info = await FileSystem.getInfoAsync(itemPath);
                if (info.exists && info.isDirectory) {
                    sessionDirs.push(item);
                }
            }

            return sessionDirs;
        } catch (error) {
            console.error('❌ Error getting session directories:', error);
            return [];
        }
    }

    /**
     * Clean up orphaned session directories that don't have corresponding active sessions
     * @param activeSessions - Array of active session IDs
     */
    static async cleanupOrphanedSessions(activeSessions: string[]): Promise<void> {
        try {
            const allDirs = await this.getAllSessionDirectories();
            const orphanedDirs = allDirs.filter(dir => !activeSessions.includes(dir));

            if (orphanedDirs.length === 0) {
                console.log('✅ No orphaned session directories found');
                return;
            }

            console.log(`🧹 Cleaning up ${orphanedDirs.length} orphaned session directories`);

            for (const orphanedDir of orphanedDirs) {
                console.log(`🗑️ Cleaning up orphaned session: ${orphanedDir}`);
                await this.deleteSessionFiles(orphanedDir);
            }

            console.log('✅ Orphaned session cleanup complete');
        } catch (error) {
            console.error('❌ Error during orphaned session cleanup:', error);
        }
    }

    /**
     * Get the total size of all rabbit mode session files
     * @returns Size in bytes
     */
    static async getTotalStorageUsed(): Promise<number> {
        try {
            await this.ensureBaseDirectory();
            const sessionDirs = await this.getAllSessionDirectories();
            let totalSize = 0;

            for (const sessionId of sessionDirs) {
                const sessionDir = `${this.baseDir}${sessionId}/`;
                const files = await FileSystem.readDirectoryAsync(sessionDir);

                for (const file of files) {
                    const filePath = `${sessionDir}${file}`;
                    const fileInfo = await FileSystem.getInfoAsync(filePath);
                    if (fileInfo.exists && !fileInfo.isDirectory) {
                        totalSize += fileInfo.size || 0;
                    }
                }
            }

            return totalSize;
        } catch (error) {
            console.error('❌ Error calculating storage usage:', error);
            return 0;
        }
    }

    /**
     * Get storage info for a specific session
     * @param sessionId - The session to get info for
     * @returns Object with file count and total size
     */
    static async getSessionStorageInfo(sessionId: string): Promise<{
        fileCount: number;
        totalSize: number;
        files: string[];
    }> {
        try {
            const sessionDir = `${this.baseDir}${sessionId}/`;
            const dirInfo = await FileSystem.getInfoAsync(sessionDir);

            if (!dirInfo.exists) {
                return { fileCount: 0, totalSize: 0, files: [] };
            }

            const files = await FileSystem.readDirectoryAsync(sessionDir);
            let totalSize = 0;
            const validFiles: string[] = [];

            for (const file of files) {
                const filePath = `${sessionDir}${file}`;
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                if (fileInfo.exists && !fileInfo.isDirectory) {
                    totalSize += fileInfo.size || 0;
                    validFiles.push(file);
                }
            }

            return {
                fileCount: validFiles.length,
                totalSize,
                files: validFiles
            };
        } catch (error) {
            console.error('❌ Error getting session storage info:', error);
            return { fileCount: 0, totalSize: 0, files: [] };
        }
    }

    /**
     * Verify that all audio files for a session exist
     * @param sessionId - The session to verify
     * @param expectedFiles - Array of expected file URIs
     * @returns Array of missing file URIs
     */
    static async verifySessionFiles(sessionId: string, expectedFiles: string[]): Promise<string[]> {
        const missingFiles: string[] = [];

        try {
            for (const fileUri of expectedFiles) {
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (!fileInfo.exists) {
                    missingFiles.push(fileUri);
                }
            }
        } catch (error) {
            console.error('❌ Error verifying session files:', error);
            // Return all files as missing if we can't verify
            return expectedFiles;
        }

        return missingFiles;
    }
} 