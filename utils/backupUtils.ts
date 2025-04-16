import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { translation as translationSchema, asset_content_link as assetContentLinkSchema, asset as assetSchema } from '@/db/drizzleSchema';
import { isNotNull, eq } from 'drizzle-orm';

// --- Utilities moved from Drawer.tsx ---

// Note: These now live outside component scope, ensure 'system' is passed if needed.
function sanitizeAssetName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function getAssetName(system: any, assetId: string): Promise<string> {
    try {
        const assetRecord = await system.db.query.asset.findFirst({
            where: eq(assetSchema.id, assetId)
        });
        return assetRecord?.name || 'unknown_asset';
    } catch {
        return 'unknown_asset';
    }
}

async function getAudioAssetMap(system: any): Promise<Map<string, string>> {
    const translationsWithAudio = await system.db.select({
        audioId: translationSchema.audio,
        assetId: translationSchema.asset_id
    }).from(translationSchema)
        .where(isNotNull(translationSchema.audio))
        .all();
    const contentLinksWithAudio = await system.db.select({
        audioId: assetContentLinkSchema.audio_id,
        assetId: assetContentLinkSchema.asset_id
    }).from(assetContentLinkSchema)
        .where(isNotNull(assetContentLinkSchema.audio_id))
        .all();
    const audioAssetMap = new Map<string, string>();
    translationsWithAudio.forEach((t: { audioId: string | null; assetId: string | null }) => {
        if (t.audioId && t.assetId && !audioAssetMap.has(t.audioId)) {
            audioAssetMap.set(t.audioId, t.assetId);
        }
    });
    contentLinksWithAudio.forEach((l: { audioId: string | null; assetId: string | null }) => {
        if (l.audioId && l.assetId && !audioAssetMap.has(l.audioId)) {
            audioAssetMap.set(l.audioId, l.assetId);
        }
    });
    return audioAssetMap;
}


// --- Backup Helper: Database ---
export async function backupDatabase(
    baseDirectoryUri: string,
    dbFullPathName: string,
    dbSourceUri: string
): Promise<{ statusKey: 'backupDbStatusSkipped' | 'backupDbStatusSuccessful' | 'backupDbStatusFailed', error?: string }> {
    try {
        const dbFileInfo = await FileSystem.getInfoAsync(dbSourceUri);
        if (dbFileInfo.exists) {
            const dbContent = await FileSystem.readAsStringAsync(dbSourceUri, { encoding: FileSystem.EncodingType.Base64 });
            const createdDbFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, dbFullPathName, 'application/vnd.sqlite3');
            await FileSystem.writeAsStringAsync(createdDbFileUri, dbContent, { encoding: FileSystem.EncodingType.Base64 });
            return { statusKey: 'backupDbStatusSuccessful' };
        } else {
            return { statusKey: 'backupDbStatusSkipped' };
        }
    } catch (dbBackupError) {
        console.error('Error during database backup:', dbBackupError);
        const errorString = dbBackupError instanceof Error ? dbBackupError.message : String(dbBackupError);
        return { statusKey: 'backupDbStatusFailed', error: errorString };
    }
}

// --- Backup Helper: Unsynced Audio ---
export async function backupUnsyncedAudio(
    system: any, // Pass system explicitly
    baseDirectoryUri: string,
    audioBaseDirPath: string,
    timestamp: string
): Promise<{ count: number, errors: string[] }> {
    let filesBackedUpCount = 0;
    const copyErrors: string[] = [];
    try {
        // Use functions defined within this module
        const audioAssetMap = await getAudioAssetMap(system);
        const unsyncedIds = await getFilesInUploadQueue();

        if (unsyncedIds.length > 0) {
            // Consider creating the directory here if needed
            // await StorageAccessFramework.makeDirectoryAsync(baseDirectoryUri, audioBaseDirPath);
        }

        for (const [audioId, assetId] of audioAssetMap.entries()) {
            if (!audioId || !unsyncedIds.includes(audioId)) continue;

            const sourceUri = FileSystem.documentDirectory + 'attachments/' + audioId;
            const originalExtension = audioId.split('.').pop()?.toLowerCase() || 'm4a';
            // Use functions defined within this module
            const assetName = await getAssetName(system, assetId);
            const sanitizedAssetName = sanitizeAssetName(assetName);
            const backupFilenameWithAsset = `${sanitizedAssetName}_${timestamp}.${originalExtension}`;
            const audioFullPathName = `${audioBaseDirPath}/${backupFilenameWithAsset}`;

            try {
                const fileInfo = await FileSystem.getInfoAsync(sourceUri);
                if (fileInfo.exists) {
                    const fileContent = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
                    let mimeType = 'audio/mpeg';
                    if (originalExtension === 'm4a') mimeType = 'audio/aac';
                    else if (originalExtension === 'mp3') mimeType = 'audio/mpeg';
                    const createdAudioFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, audioFullPathName, mimeType);
                    await FileSystem.writeAsStringAsync(createdAudioFileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
                    filesBackedUpCount++;
                }
            } catch (fileCopyError) {
                const errorString = `Failed to copy ${audioId}: ${fileCopyError instanceof Error ? fileCopyError.message : String(fileCopyError)}`;
                console.error(errorString);
                copyErrors.push(errorString);
            }
        }
    } catch (audioQueryError) {
        console.error('Error retrieving audio file list:', audioQueryError);
        // Re-throw critical errors related to getting the list itself
        throw audioQueryError;
    }
    return { count: filesBackedUpCount, errors: copyErrors };
} 