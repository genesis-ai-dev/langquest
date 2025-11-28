import {
  asset,
  asset_content_link,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  fileExists,
  getLocalAttachmentUriWithOPFS,
  normalizeFileUri
} from '@/utils/fileUtils';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import { concatAudioFiles, convertToM4a } from 'react-native-audio-concat';

/**
 * Convert file:// URI to a path that native modules can use
 * Some native modules need paths without the file:// prefix
 */
function getNativePath(uri: string): string {
  const normalized = normalizeFileUri(uri);
  // Remove file:// prefix for native modules
  if (normalized.startsWith('file://')) {
    return normalized.replace(/^file:\/\//, '');
  }
  return normalized;
}

/**
 * Get all audio file URIs for a quest's assets in order
 */
async function getQuestAudioUris(questId: string): Promise<string[]> {
  // Get all asset IDs for this quest
  const questAssetLinks = await system.db
    .select({ asset_id: quest_asset_link.asset_id })
    .from(quest_asset_link)
    .where(eq(quest_asset_link.quest_id, questId));

  const assetIds = questAssetLinks.map((link) => link.asset_id);

  if (assetIds.length === 0) {
    return [];
  }

  // Get all content links with audio for these assets
  const contentLinks = await system.db
    .select()
    .from(asset_content_link)
    .where(
      and(
        inArray(asset_content_link.asset_id, assetIds),
        isNotNull(asset_content_link.audio)
      )
    );

  // Extract audio values and convert to local URIs
  // Order by asset order_index and content created_at to maintain proper sequence
  const audioUris: string[] = [];

  // Get assets with order_index to maintain proper sequence
  // Join with asset table to get order_index
  const assetsWithOrder = await system.db
    .select({
      asset_id: quest_asset_link.asset_id,
      order_index: asset.order_index
    })
    .from(quest_asset_link)
    .innerJoin(asset, eq(quest_asset_link.asset_id, asset.id))
    .where(eq(quest_asset_link.quest_id, questId))
    .orderBy(asc(asset.order_index), asc(asset.created_at));

  // Process assets in order
  for (const assetLink of assetsWithOrder) {
    if (!assetLink.asset_id) {
      continue;
    }

    const assetContentLinks = contentLinks.filter(
      (link) => link.asset_id === assetLink.asset_id
    );

    // Sort content links by created_at to maintain order within asset
    assetContentLinks.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

    for (const contentLink of assetContentLinks) {
      if (!contentLink.audio || contentLink.audio.length === 0) {
        continue;
      }

      for (const audioValue of contentLink.audio) {
        if (!audioValue || typeof audioValue !== 'string') {
          continue;
        }

        let localUri: string | null = null;

        // Handle direct local URIs (from recording view before publish)
        if (audioValue.startsWith('local/')) {
          localUri = getLocalAttachmentUriWithOPFS(audioValue);
        } else if (audioValue.startsWith('file://')) {
          // Already a full file URI
          localUri = audioValue;
        } else {
          // It's an attachment ID - look it up in the attachment queue
          if (!system.permAttachmentQueue) {
            continue;
          }

          const attachment = await system.powersync.getOptional<{
            id: string;
            local_uri: string | null;
          }>(`SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`, [
            audioValue
          ]);

          if (attachment?.local_uri) {
            localUri = system.permAttachmentQueue.getLocalUri(
              attachment.local_uri
            );
          }
        }

        // Verify file exists before adding
        if (localUri && (await fileExists(localUri))) {
          audioUris.push(localUri);
        } else {
          console.warn(`Audio file not found: ${localUri}`);
        }
      }
    }
  }

  return audioUris;
}

/**
 * Concatenate audio files for a quest and share the result
 */
export async function concatenateAndShareQuestAudio(
  questId: string,
  questName?: string
): Promise<void> {
  try {
    // Get all audio URIs for the quest
    const audioUris = await getQuestAudioUris(questId);

    if (audioUris.length === 0) {
      throw new Error('No audio files found for this quest');
    }

    // Convert .wav files to .m4a first (library may not support .wav directly)
    // Also ensure all files are in a format the library can handle
    const convertedUris: string[] = [];
    const tempFiles: string[] = [];

    for (let i = 0; i < audioUris.length; i++) {
      const uri = audioUris[i];
      if (!uri) {
        console.warn(`Skipping undefined URI at index ${i}`);
        continue;
      }

      // Normalize URI and get native path
      const normalizedUri = normalizeFileUri(uri);
      const nativePath = getNativePath(normalizedUri);

      // Double-check file exists with normalized path
      if (!(await fileExists(normalizedUri))) {
        console.warn(`File does not exist (normalized): ${normalizedUri}`);
        continue;
      }

      const isWav = normalizedUri.toLowerCase().endsWith('.wav');

      if (isWav) {
        // Convert .wav to .m4a
        const tempM4aPath = `${FileSystem.cacheDirectory}temp_${Date.now()}_${i}.m4a`;
        const tempM4aNativePath = getNativePath(tempM4aPath);
        tempFiles.push(tempM4aPath);
        console.log(`Converting ${nativePath} to ${tempM4aNativePath}...`);
        try {
          // Use native paths (without file://) for the library
          const convertedPath = await convertToM4a(
            nativePath,
            tempM4aNativePath
          );
          // Convert back to file:// URI format for consistency
          const convertedUri = convertedPath.startsWith('file://')
            ? convertedPath
            : `file://${convertedPath}`;
          if (convertedUri && (await fileExists(convertedUri))) {
            convertedUris.push(convertedUri);
          } else {
            console.warn(
              `Converted file not found: ${convertedUri}, skipping this file`
            );
            // Don't fall back to original - if conversion fails, skip it
          }
        } catch (error) {
          console.warn(`Failed to convert ${nativePath}, skipping:`, error);
          // Don't use original .wav file - library can't handle it
        }
      } else {
        // Already in a supported format (likely .m4a)
        convertedUris.push(normalizedUri);
      }
    }

    if (convertedUris.length === 0) {
      throw new Error('No valid audio files found after conversion');
    }

    // Create output file path (use native path format)
    const outputFileName = `${questName || 'quest'}-${Date.now()}.m4a`;
    const outputPath = `${FileSystem.cacheDirectory}${outputFileName}`;
    const outputNativePath = getNativePath(outputPath);

    // Convert audio URIs to the format expected by concatAudioFiles
    // The API expects an array of objects with filePath property
    // Use native paths (without file://) for the library
    const audioData = convertedUris
      .filter((uri) => uri && uri.length > 0)
      .map((uri) => ({ filePath: getNativePath(uri) }));

    if (audioData.length === 0) {
      throw new Error('No valid audio files to concatenate');
    }

    // Concatenate audio files (use native paths)
    console.log(`Concatenating ${audioData.length} audio files...`);
    console.log(
      'Audio files:',
      audioData.map((d) => d.filePath)
    );
    const concatResult = await concatAudioFiles(audioData, outputNativePath);
    console.log('Concatenation result:', concatResult);

    // Clean up temporary converted files
    for (const tempFile of tempFiles) {
      try {
        await FileSystem.deleteAsync(tempFile, { idempotent: true });
      } catch (error) {
        console.warn(`Failed to delete temp file ${tempFile}:`, error);
      }
    }

    console.log(`Audio concatenated successfully: ${outputPath}`);

    // Share the concatenated file (use file:// URI format for Share API)
    const result = await Share.share({
      url: outputPath, // Share API expects file:// URI
      title: questName || 'Quest Audio',
      message: `Audio export: ${questName || 'Quest'}`
    });

    if (result.action === Share.sharedAction) {
      console.log('Audio shared successfully');
    } else {
      console.log('Share dismissed or cancelled');
    }
  } catch (error) {
    console.error('Failed to concatenate and share audio:', error);
    throw error;
  }
}
