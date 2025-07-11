import type { BibleReference } from '@/constants/bibleStructure';
import { system } from '@/db/powersync/system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

// Storage keys
const BIBLE_SESSIONS_KEY = 'bible_recording_sessions';
const BIBLE_ASSETS_KEY = 'bible_recording_assets';
const BIBLE_PROJECTS_KEY = 'bible_recording_projects';

// Types
export interface RecordingSegment {
    id: string;
    startTime: number;
    endTime: number;
    audioUri: string;
    localPath: string;
    waveformData?: number[];
    isComplete: boolean;
    reference: BibleReference;
    tempAttachmentId?: string;
}

export interface CachedBibleProject {
    id: string;
    name: string;
    description?: string;
    sourceLanguageId: string;
    targetLanguageId: string;
    creatorId: string;
    currentReference: BibleReference;
    segments: RecordingSegment[];
    createdAt: number;
    lastModified: number;
    isConfirmed: boolean;
    totalDuration: number;
    projectType: 'bible_translation';
}

export interface BibleAsset {
    id: string;
    projectId: string;
    name: string;
    reference: BibleReference;
    sourceLanguageId: string;
    audioUri: string;
    localPath: string;
    duration: number;
    waveformData?: number[];
    createdAt: number;
    isUploaded: boolean;
    tempAttachmentId?: string;
}

export interface BibleRecordingSession {
    id: string;
    projectId: string;
    startTime: number;
    endTime?: number;
    currentReference: BibleReference;
    isActive: boolean;
    segments: RecordingSegment[];
    lastModified: number;
}

class BibleRecordingCacheService {
    private readonly documentsDirectory: string;
    private readonly audioDirectory: string;
    private readonly tempDirectory: string;

    constructor() {
        this.documentsDirectory = FileSystem.documentDirectory || '';
        this.audioDirectory = `${this.documentsDirectory}bible_recordings/`;
        this.tempDirectory = `${this.documentsDirectory}temp_recordings/`;
    }

    // Initialize directories
    async initialize(): Promise<void> {
        try {
            // Create directories if they don't exist
            await FileSystem.makeDirectoryAsync(this.audioDirectory, { intermediates: true });
            await FileSystem.makeDirectoryAsync(this.tempDirectory, { intermediates: true });

            console.log('BibleRecordingCacheService initialized');
        } catch (error) {
            console.error('Error initializing BibleRecordingCacheService:', error);
        }
    }

    // Project Management
    async saveCachedProject(project: CachedBibleProject): Promise<void> {
        try {
            const projects = await this.getCachedProjects();
            const existingIndex = projects.findIndex(p => p.id === project.id);

            if (existingIndex >= 0) {
                projects[existingIndex] = {
                    ...project,
                    lastModified: Date.now()
                };
            } else {
                projects.push(project);
            }

            await AsyncStorage.setItem(BIBLE_PROJECTS_KEY, JSON.stringify(projects));
            console.log(`Cached Bible project saved: ${project.name}`);
        } catch (error) {
            console.error('Error saving cached project:', error);
            throw error;
        }
    }

    async getCachedProjects(): Promise<CachedBibleProject[]> {
        try {
            const projectsJson = await AsyncStorage.getItem(BIBLE_PROJECTS_KEY);
            return projectsJson ? JSON.parse(projectsJson) : [];
        } catch (error) {
            console.error('Error getting cached projects:', error);
            return [];
        }
    }

    async getCachedProject(projectId: string): Promise<CachedBibleProject | null> {
        try {
            const projects = await this.getCachedProjects();
            return projects.find(p => p.id === projectId) || null;
        } catch (error) {
            console.error('Error getting cached project:', error);
            return null;
        }
    }

    async deleteCachedProject(projectId: string): Promise<void> {
        try {
            const projects = await this.getCachedProjects();
            const project = projects.find(p => p.id === projectId);

            if (project) {
                // Clean up associated audio files
                for (const segment of project.segments) {
                    await this.deleteAudioFile(segment.localPath);
                }

                // Remove from cache
                const updatedProjects = projects.filter(p => p.id !== projectId);
                await AsyncStorage.setItem(BIBLE_PROJECTS_KEY, JSON.stringify(updatedProjects));

                console.log(`Cached Bible project deleted: ${projectId}`);
            }
        } catch (error) {
            console.error('Error deleting cached project:', error);
            throw error;
        }
    }

    // Session Management
    async saveRecordingSession(session: BibleRecordingSession): Promise<void> {
        try {
            const sessions = await this.getRecordingSessions();
            const existingIndex = sessions.findIndex(s => s.id === session.id);

            if (existingIndex >= 0) {
                sessions[existingIndex] = {
                    ...session,
                    lastModified: Date.now()
                };
            } else {
                sessions.push(session);
            }

            await AsyncStorage.setItem(BIBLE_SESSIONS_KEY, JSON.stringify(sessions));
        } catch (error) {
            console.error('Error saving recording session:', error);
            throw error;
        }
    }

    async getRecordingSessions(): Promise<BibleRecordingSession[]> {
        try {
            const sessionsJson = await AsyncStorage.getItem(BIBLE_SESSIONS_KEY);
            return sessionsJson ? JSON.parse(sessionsJson) : [];
        } catch (error) {
            console.error('Error getting recording sessions:', error);
            return [];
        }
    }

    async getActiveSession(projectId: string): Promise<BibleRecordingSession | null> {
        try {
            const sessions = await this.getRecordingSessions();
            return sessions.find(s => s.projectId === projectId && s.isActive) || null;
        } catch (error) {
            console.error('Error getting active session:', error);
            return null;
        }
    }

    async endRecordingSession(sessionId: string): Promise<void> {
        try {
            const sessions = await this.getRecordingSessions();
            const session = sessions.find(s => s.id === sessionId);

            if (session) {
                session.isActive = false;
                session.endTime = Date.now();
                session.lastModified = Date.now();

                await AsyncStorage.setItem(BIBLE_SESSIONS_KEY, JSON.stringify(sessions));
            }
        } catch (error) {
            console.error('Error ending recording session:', error);
            throw error;
        }
    }

    // Audio File Management
    async saveAudioFile(tempUri: string, reference: BibleReference, projectId: string): Promise<string> {
        try {
            const filename = `${projectId}_${reference.book}_${reference.chapter}_${reference.verse}_${Date.now()}.m4a`;
            const permanentPath = `${this.audioDirectory}${filename}`;

            // Copy from temp location to permanent location
            await FileSystem.copyAsync({
                from: tempUri,
                to: permanentPath
            });

            // Clean up temp file
            try {
                await FileSystem.deleteAsync(tempUri);
            } catch (deleteError) {
                console.warn('Could not delete temp file:', deleteError);
            }

            console.log(`Audio file saved: ${filename}`);
            return permanentPath;
        } catch (error) {
            console.error('Error saving audio file:', error);
            throw error;
        }
    }

    async getAudioFileUri(localPath: string): Promise<string | null> {
        try {
            const fileInfo = await FileSystem.getInfoAsync(localPath);
            return fileInfo.exists ? localPath : null;
        } catch (error) {
            console.error('Error getting audio file URI:', error);
            return null;
        }
    }

    async deleteAudioFile(localPath: string): Promise<void> {
        try {
            const fileInfo = await FileSystem.getInfoAsync(localPath);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(localPath);
                console.log(`Audio file deleted: ${localPath}`);
            }
        } catch (error) {
            console.error('Error deleting audio file:', error);
        }
    }

    // Asset Management
    async saveBibleAsset(asset: BibleAsset): Promise<void> {
        try {
            const assets = await this.getBibleAssets();
            const existingIndex = assets.findIndex(a => a.id === asset.id);

            if (existingIndex >= 0) {
                assets[existingIndex] = asset;
            } else {
                assets.push(asset);
            }

            await AsyncStorage.setItem(BIBLE_ASSETS_KEY, JSON.stringify(assets));
        } catch (error) {
            console.error('Error saving Bible asset:', error);
            throw error;
        }
    }

    async getBibleAssets(): Promise<BibleAsset[]> {
        try {
            const assetsJson = await AsyncStorage.getItem(BIBLE_ASSETS_KEY);
            return assetsJson ? JSON.parse(assetsJson) : [];
        } catch (error) {
            console.error('Error getting Bible assets:', error);
            return [];
        }
    }

    async getBibleAssetsByProject(projectId: string): Promise<BibleAsset[]> {
        try {
            const assets = await this.getBibleAssets();
            return assets.filter(a => a.projectId === projectId);
        } catch (error) {
            console.error('Error getting Bible assets by project:', error);
            return [];
        }
    }

    // Convert cached project to actual database records
    async confirmProject(projectId: string): Promise<{
        projectId: string;
        assetIds: string[];
        questId: string;
    }> {
        try {
            const cachedProject = await this.getCachedProject(projectId);
            if (!cachedProject) {
                throw new Error('Cached project not found');
            }

            const { db } = system;

            // Create project record
            const projectRecord = {
                id: randomUUID(),
                name: cachedProject.name,
                description: cachedProject.description || '',
                source_language_id: cachedProject.sourceLanguageId,
                target_language_id: cachedProject.targetLanguageId,
                creator_id: cachedProject.creatorId,
                private: false,
                visible: true,
                active: true,
                created_at: new Date(cachedProject.createdAt).toISOString(),
                last_updated: new Date().toISOString()
            };

            await db.insert(system.drizzleSchema.project).values(projectRecord);

            // Create quest for this Bible book
            const questRecord = {
                id: randomUUID(),
                name: `${cachedProject.name} - Recording Session`,
                description: `Bible recording session for ${cachedProject.name}`,
                project_id: projectRecord.id,
                creator_id: cachedProject.creatorId,
                visible: true,
                active: true,
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString()
            };

            await db.insert(system.drizzleSchema.quest).values(questRecord);

            // Create assets for each segment
            const assetIds: string[] = [];

            for (const segment of cachedProject.segments) {
                const assetId = randomUUID();

                // Create asset record
                const assetRecord = {
                    id: assetId,
                    name: `${cachedProject.name} - ${segment.reference.book} ${segment.reference.chapter}:${segment.reference.verse}`,
                    source_language_id: cachedProject.sourceLanguageId,
                    creator_id: cachedProject.creatorId,
                    visible: true,
                    active: true,
                    created_at: new Date(segment.startTime).toISOString(),
                    last_updated: new Date().toISOString()
                };

                await db.insert(system.drizzleSchema.asset).values(assetRecord);

                // Link asset to quest
                await db.insert(system.drizzleSchema.quest_asset_link).values({
                    quest_id: questRecord.id,
                    asset_id: assetId,
                    active: true,
                    created_at: new Date().toISOString(),
                    last_updated: new Date().toISOString()
                });

                // Save audio file to attachment system
                if (segment.localPath && system.permAttachmentQueue) {
                    const attachment = await system.permAttachmentQueue.saveAudio(segment.localPath);
                    segment.tempAttachmentId = attachment.filename;
                }

                // Create asset content link
                await db.insert(system.drizzleSchema.asset_content_link).values({
                    id: randomUUID(),
                    asset_id: assetId,
                    text: `Verse ${segment.reference.verse}`,
                    audio_id: segment.tempAttachmentId || null,
                    active: true,
                    created_at: new Date().toISOString(),
                    last_updated: new Date().toISOString()
                });

                assetIds.push(assetId);
            }

            // Mark project as confirmed
            cachedProject.isConfirmed = true;
            await this.saveCachedProject(cachedProject);

            console.log(`Project confirmed: ${projectRecord.name}`);

            return {
                projectId: projectRecord.id,
                assetIds,
                questId: questRecord.id
            };

        } catch (error) {
            console.error('Error confirming project:', error);
            throw error;
        }
    }

    // Cleanup and maintenance
    async cleanupOldSessions(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
        try {
            const sessions = await this.getRecordingSessions();
            const now = Date.now();

            const sessionsToDelete = sessions.filter(s =>
                !s.isActive && (now - s.lastModified) > maxAge
            );

            for (const session of sessionsToDelete) {
                // Clean up associated audio files
                for (const segment of session.segments) {
                    await this.deleteAudioFile(segment.localPath);
                }
            }

            const remainingSessions = sessions.filter(s =>
                s.isActive || (now - s.lastModified) <= maxAge
            );

            await AsyncStorage.setItem(BIBLE_SESSIONS_KEY, JSON.stringify(remainingSessions));

            console.log(`Cleaned up ${sessionsToDelete.length} old sessions`);
        } catch (error) {
            console.error('Error cleaning up old sessions:', error);
        }
    }

    async getStorageUsage(): Promise<{
        totalFiles: number;
        totalSize: number;
        oldestFile: number;
        newestFile: number;
    }> {
        try {
            const audioFiles = await FileSystem.readDirectoryAsync(this.audioDirectory);
            let totalSize = 0;
            let oldestFile = Date.now();
            let newestFile = 0;

            for (const filename of audioFiles) {
                const filePath = `${this.audioDirectory}${filename}`;
                const fileInfo = await FileSystem.getInfoAsync(filePath);

                if (fileInfo.exists && fileInfo.size) {
                    totalSize += fileInfo.size;

                    if (fileInfo.modificationTime) {
                        const modTime = fileInfo.modificationTime;
                        if (modTime < oldestFile) oldestFile = modTime;
                        if (modTime > newestFile) newestFile = modTime;
                    }
                }
            }

            return {
                totalFiles: audioFiles.length,
                totalSize,
                oldestFile,
                newestFile
            };
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return {
                totalFiles: 0,
                totalSize: 0,
                oldestFile: 0,
                newestFile: 0
            };
        }
    }

    // Backup and restore
    async exportProject(projectId: string): Promise<string> {
        try {
            const project = await this.getCachedProject(projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            const exportData = {
                project,
                exportedAt: Date.now(),
                version: '1.0'
            };

            const exportPath = `${this.audioDirectory}export_${projectId}_${Date.now()}.json`;
            await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(exportData, null, 2));

            return exportPath;
        } catch (error) {
            console.error('Error exporting project:', error);
            throw error;
        }
    }

    async importProject(importPath: string): Promise<string> {
        try {
            const importData = await FileSystem.readAsStringAsync(importPath);
            const parsedData = JSON.parse(importData);

            if (!parsedData.project || !parsedData.version) {
                throw new Error('Invalid import file format');
            }

            const project: CachedBibleProject = parsedData.project;
            project.id = randomUUID(); // Generate new ID to avoid conflicts
            project.lastModified = Date.now();
            project.isConfirmed = false;

            await this.saveCachedProject(project);

            return project.id;
        } catch (error) {
            console.error('Error importing project:', error);
            throw error;
        }
    }
}

// Singleton instance
export const bibleRecordingCache = new BibleRecordingCacheService();

// Initialize on app start
export const initializeBibleRecordingCache = async () => {
    await bibleRecordingCache.initialize();
};

export default bibleRecordingCache; 