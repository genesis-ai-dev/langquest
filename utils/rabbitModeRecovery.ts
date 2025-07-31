import { useLocalStore } from '@/store/localStore';
import { Alert } from 'react-native';
import { RabbitModeFileManager } from './rabbitModeFileManager';

export interface RecoveryStats {
    totalSessions: number;
    staleSessions: number;
    orphanedFiles: number;
    recoveredSessions: number;
    cleanedUpSessions: number;
}

export class RabbitModeRecovery {
    /**
     * Initialize rabbit mode recovery at app startup
     */
    static async initialize(): Promise<RecoveryStats> {
        console.log('🔧 Initializing rabbit mode recovery...');

        const stats: RecoveryStats = {
            totalSessions: 0,
            staleSessions: 0,
            orphanedFiles: 0,
            recoveredSessions: 0,
            cleanedUpSessions: 0
        };

        try {
            // Get all active sessions from local store
            const allSessions = useLocalStore.getState().rabbitModeSessions || [];
            stats.totalSessions = allSessions.length;

            console.log(`📊 Found ${stats.totalSessions} rabbit mode sessions`);

            // Clean up any orphaned file directories
            const activeSessions = allSessions.map(s => s.id);
            await RabbitModeFileManager.cleanupOrphanedSessions(activeSessions);

            // Find stale sessions (older than 7 days and not committed)
            const staleThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const staleSessions = allSessions.filter(
                session => !session.isCommitted &&
                    new Date(session.last_updated).getTime() < staleThreshold
            );

            stats.staleSessions = staleSessions.length;

            if (staleSessions.length > 0) {
                console.log(`⚠️ Found ${staleSessions.length} stale sessions`);
                await this.handleStaleSessions(staleSessions, stats);
            } else {
                console.log('✅ No stale sessions found');
            }

            // Verify file integrity for active sessions
            await this.verifyActiveSessionFiles(allSessions.filter(s => !s.isCommitted), stats);

            console.log('🎉 Rabbit mode recovery completed', stats);
            return stats;

        } catch (error) {
            console.error('❌ Error during rabbit mode recovery:', error);
            return stats;
        }
    }

    /**
     * Handle stale sessions by prompting user
     */
    private static async handleStaleSessions(
        staleSessions: any[],
        stats: RecoveryStats
    ): Promise<void> {
        return new Promise((resolve) => {
            Alert.alert(
                'Recover Draft Recordings?',
                `Found ${staleSessions.length} old draft recording sessions. What would you like to do?`,
                [
                    {
                        text: 'Delete All',
                        style: 'destructive',
                        onPress: async () => {
                            await this.cleanupStaleSessions(staleSessions);
                            stats.cleanedUpSessions = staleSessions.length;
                            resolve();
                        }
                    },
                    {
                        text: 'Keep All',
                        style: 'default',
                        onPress: () => {
                            console.log('User chose to keep stale sessions');
                            stats.recoveredSessions = staleSessions.length;
                            resolve();
                        }
                    },
                    {
                        text: 'Review',
                        style: 'default',
                        onPress: () => {
                            // TODO: Implement review interface
                            console.log('Review interface not implemented yet');
                            stats.recoveredSessions = staleSessions.length;
                            resolve();
                        }
                    }
                ],
                { cancelable: false }
            );
        });
    }

    /**
     * Clean up stale sessions
     */
    private static async cleanupStaleSessions(staleSessions: any[]): Promise<void> {
        console.log(`🗑️ Cleaning up ${staleSessions.length} stale sessions`);

        for (const session of staleSessions) {
            try {
                // Delete session files
                await RabbitModeFileManager.deleteSessionFiles(session.id);

                // Remove from local store
                useLocalStore.getState().deleteRabbitModeSession(session.id);

                console.log(`✅ Cleaned up stale session: ${session.id}`);
            } catch (error) {
                console.error(`❌ Failed to clean up session ${session.id}:`, error);
            }
        }
    }

    /**
     * Verify that all active session files exist
     */
    private static async verifyActiveSessionFiles(
        activeSessions: any[],
        stats: RecoveryStats
    ): Promise<void> {
        console.log(`🔍 Verifying files for ${activeSessions.length} active sessions`);

        for (const session of activeSessions) {
            try {
                const allAudioFiles: string[] = [];

                // Collect all audio file paths
                for (const asset of session.assets || []) {
                    for (const segment of asset.segments || []) {
                        if (segment.audioUri) {
                            allAudioFiles.push(segment.audioUri);
                        }
                    }
                }

                if (allAudioFiles.length > 0) {
                    const missingFiles = await RabbitModeFileManager.verifySessionFiles(
                        session.id,
                        allAudioFiles
                    );

                    if (missingFiles.length > 0) {
                        console.warn(
                            `⚠️ Session ${session.id} has ${missingFiles.length} missing files`
                        );
                        stats.orphanedFiles += missingFiles.length;
                    }
                }
            } catch (error) {
                console.error(`❌ Error verifying session ${session.id}:`, error);
            }
        }
    }

    /**
     * Get recovery statistics without running full recovery
     */
    static async getRecoveryStats(): Promise<RecoveryStats> {
        const stats: RecoveryStats = {
            totalSessions: 0,
            staleSessions: 0,
            orphanedFiles: 0,
            recoveredSessions: 0,
            cleanedUpSessions: 0
        };

        try {
            const allSessions = useLocalStore.getState().rabbitModeSessions || [];
            stats.totalSessions = allSessions.length;

            const staleThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
            stats.staleSessions = allSessions.filter(
                session => !session.isCommitted &&
                    new Date(session.last_updated).getTime() < staleThreshold
            ).length;

            return stats;
        } catch (error) {
            console.error('Error getting recovery stats:', error);
            return stats;
        }
    }

    /**
     * Force cleanup of all draft sessions (use with caution)
     */
    static async forceCleanupAllSessions(): Promise<void> {
        console.log('🚨 Force cleaning up ALL rabbit mode sessions');

        try {
            const allSessions = useLocalStore.getState().rabbitModeSessions || [];

            for (const session of allSessions) {
                try {
                    await RabbitModeFileManager.deleteSessionFiles(session.id);
                    useLocalStore.getState().deleteRabbitModeSession(session.id);
                } catch (error) {
                    console.error(`Failed to force cleanup session ${session.id}:`, error);
                }
            }

            // Clean up any remaining orphaned directories
            await RabbitModeFileManager.cleanupOrphanedSessions([]);

            console.log('✅ Force cleanup completed');
        } catch (error) {
            console.error('❌ Error during force cleanup:', error);
            throw error;
        }
    }
} 