import {
  asset,
  languoid,
  profile,
  project,
  project_language_link,
  quest,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import {
  fileExists,
  getLocalAttachmentUriWithOPFS,
  normalizeFileUri
} from '@/utils/fileUtils';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Conditionally import react-native-audio-concat only on native platforms
// On web, metro.config.js returns empty module, so we need to handle it gracefully
type ConcatAudioFiles = (
  audioData: { filePath: string }[],
  outputPath: string
) => Promise<string>;
type ConvertToM4a = (inputPath: string, outputPath: string) => Promise<string>;

let concatAudioFiles: ConcatAudioFiles | undefined;
let convertToM4a: ConvertToM4a | undefined;

if (Platform.OS !== 'web') {
  try {
    const audioConcatModule = require('react-native-audio-concat');
    concatAudioFiles = audioConcatModule.concatAudioFiles;
    convertToM4a = audioConcatModule.convertToM4a;
  } catch (error) {
    console.warn('Failed to load react-native-audio-concat:', error);
  }
}

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
 *
 * FALLBACK STRATEGY:
 * - First tries synced table (may have attachment IDs)
 * - If attachment ID not found in queue, falls back to local table
 * - This handles edge case where server records were removed but local records remain
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

  // Get content links from synced table first (preferred source)
  const assetContentLinkSynced = resolveTable('asset_content_link', {
    localOverride: false
  });
  const contentLinksSynced = await system.db
    .select()
    .from(assetContentLinkSynced)
    .where(
      and(
        inArray(assetContentLinkSynced.asset_id, assetIds),
        isNotNull(assetContentLinkSynced.audio)
      )
    );

  // Also get content links from local table as fallback
  const assetContentLinkLocal = resolveTable('asset_content_link', {
    localOverride: true
  });
  const contentLinksLocal = await system.db
    .select()
    .from(assetContentLinkLocal)
    .where(
      and(
        inArray(assetContentLinkLocal.asset_id, assetIds),
        isNotNull(assetContentLinkLocal.audio)
      )
    );

  // Create a map of local content links by asset_id and created_at for quick lookup
  // We'll use this to find fallback local URIs when synced attachment IDs don't resolve
  const localLinksByAsset = new Map<string, typeof contentLinksLocal>();
  for (const localLink of contentLinksLocal) {
    const key = localLink.asset_id;
    if (!localLinksByAsset.has(key)) {
      localLinksByAsset.set(key, []);
    }
    localLinksByAsset.get(key)!.push(localLink);
  }

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

    // Prefer synced content links, but fall back to local if needed
    const syncedLinks = contentLinksSynced.filter(
      (link) => link.asset_id === assetLink.asset_id
    );
    const localLinks = localLinksByAsset.get(assetLink.asset_id) || [];

    // Merge synced and local links, preferring synced
    // Sort by created_at to maintain order
    const allLinks = [...syncedLinks, ...localLinks];
    allLinks.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

    // Deduplicate by ID (prefer synced over local)
    const seenIds = new Set<string>();
    const uniqueLinks = allLinks.filter((link) => {
      if (seenIds.has(link.id)) {
        return false;
      }
      seenIds.add(link.id);
      return true;
    });

    // Track which local links we've used as fallbacks to avoid duplicates
    const usedLocalLinkIds = new Set<string>();

    for (const contentLink of uniqueLinks) {
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
          const constructedUri =
            await getLocalAttachmentUriWithOPFS(audioValue);
          // Check if file exists at constructed path
          if (await fileExists(constructedUri)) {
            localUri = constructedUri;
          } else {
            // File doesn't exist at expected path - try to find it in attachment queue
            // This handles case where file was moved to attachment queue during publish
            console.log(
              `⚠️ Local URI ${audioValue} not found at ${constructedUri}, searching attachment queue...`
            );

            if (system.permAttachmentQueue) {
              // Extract filename from local path (e.g., "local/uuid.wav" -> "uuid.wav")
              const filename = audioValue.replace(/^local\//, '');
              // Extract UUID part (without extension) for more flexible matching
              const uuidPart = filename.split('.')[0];

              // Search attachment queue by filename or UUID
              let attachment = await system.powersync.getOptional<{
                id: string;
                filename: string | null;
                local_uri: string | null;
              }>(
                `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR filename LIKE ? OR id = ? OR id LIKE ? LIMIT 1`,
                [filename, `%${uuidPart}%`, filename, `%${uuidPart}%`]
              );

              // If not found, try searching all attachments for this asset's content links
              // The attachment might be referenced by a different ID
              if (!attachment && contentLink.audio.length > 0) {
                const allAttachmentIds = contentLink.audio.filter(
                  (av): av is string =>
                    typeof av === 'string' &&
                    !av.startsWith('local/') &&
                    !av.startsWith('file://')
                );
                if (allAttachmentIds.length > 0) {
                  // Try to find any of these attachment IDs in the queue
                  const placeholders = allAttachmentIds
                    .map(() => '?')
                    .join(',');
                  attachment = await system.powersync.getOptional<{
                    id: string;
                    filename: string | null;
                    local_uri: string | null;
                  }>(
                    `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id IN (${placeholders}) LIMIT 1`,
                    allAttachmentIds
                  );
                }
              }

              if (attachment?.local_uri) {
                const foundUri = system.permAttachmentQueue.getLocalUri(
                  attachment.local_uri
                );
                // Verify the found file actually exists
                if (await fileExists(foundUri)) {
                  localUri = foundUri;
                  console.log(
                    `✅ Found attachment in queue for local URI ${audioValue.slice(0, 20)}`
                  );
                } else {
                  console.warn(
                    `⚠️ Attachment found in queue but file doesn't exist: ${foundUri}`
                  );
                }
              } else {
                // Still not found - try fallback to local table
                const fallbackLocalLink =
                  localLinks.find((link) => link.id === contentLink.id) ||
                  localLinks.find(
                    (link) =>
                      link.asset_id === contentLink.asset_id &&
                      link.created_at === contentLink.created_at
                  );

                if (fallbackLocalLink?.audio) {
                  // Try other audio values from the same link
                  for (const fallbackAudioValue of fallbackLocalLink.audio) {
                    if (fallbackAudioValue.startsWith('file://')) {
                      if (await fileExists(fallbackAudioValue)) {
                        localUri = fallbackAudioValue;
                        console.log(`✅ Found fallback file URI`);
                        break;
                      }
                    }
                  }
                }
              }
            } else {
              // No attachment queue - try fallback to local table
              const fallbackLocalLink =
                localLinks.find((link) => link.id === contentLink.id) ||
                localLinks.find(
                  (link) =>
                    link.asset_id === contentLink.asset_id &&
                    link.created_at === contentLink.created_at
                );

              if (fallbackLocalLink?.audio) {
                // Try other audio values from the same link
                for (const fallbackAudioValue of fallbackLocalLink.audio) {
                  if (fallbackAudioValue.startsWith('file://')) {
                    if (await fileExists(fallbackAudioValue)) {
                      localUri = fallbackAudioValue;
                      console.log(`✅ Found fallback file URI`);
                      break;
                    }
                  }
                }
              }
            }
          }
        } else if (audioValue.startsWith('file://')) {
          // Already a full file URI - verify it exists
          if (await fileExists(audioValue)) {
            localUri = audioValue;
          } else {
            console.warn(`File URI does not exist: ${audioValue}`);
            // Try to find in attachment queue by extracting filename from path
            if (system.permAttachmentQueue) {
              const filename = audioValue.split('/').pop();
              if (filename) {
                const attachment = await system.powersync.getOptional<{
                  id: string;
                  filename: string | null;
                  local_uri: string | null;
                }>(
                  `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR id = ? LIMIT 1`,
                  [filename, filename]
                );

                if (attachment?.local_uri) {
                  localUri = system.permAttachmentQueue.getLocalUri(
                    attachment.local_uri
                  );
                  console.log(`✅ Found attachment in queue for file URI`);
                }
              }
            }
          }
        } else {
          // It's an attachment ID - look it up in the attachment queue
          if (!system.permAttachmentQueue) {
            // No attachment queue - try to find fallback in local table
            console.log(
              `⚠️ No attachment queue available, checking local table fallback for attachment ${audioValue.slice(0, 8)}...`
            );

            // First try to find local link with same ID (most reliable match)
            let fallbackLocalLink = localLinks.find(
              (link) => link.id === contentLink.id
            );

            // If not found by ID, try to find by asset_id and created_at (same content link)
            if (!fallbackLocalLink) {
              fallbackLocalLink = localLinks.find(
                (link) =>
                  link.asset_id === contentLink.asset_id &&
                  link.created_at === contentLink.created_at
              );
            }

            // If still not found, use any unused local link for this asset (last resort)
            if (!fallbackLocalLink && localLinks.length > 0) {
              fallbackLocalLink = localLinks.find(
                (link) => !usedLocalLinkIds.has(link.id)
              );
              if (fallbackLocalLink) {
                usedLocalLinkIds.add(fallbackLocalLink.id);
              }
            } else if (fallbackLocalLink) {
              usedLocalLinkIds.add(fallbackLocalLink.id);
            }

            if (fallbackLocalLink?.audio) {
              // Find any local URI in the fallback link
              for (const fallbackAudioValue of fallbackLocalLink.audio) {
                if (fallbackAudioValue.startsWith('local/')) {
                  localUri =
                    await getLocalAttachmentUriWithOPFS(fallbackAudioValue);
                  console.log(
                    `✅ Found fallback local URI for attachment ${audioValue.slice(0, 8)}`
                  );
                  break;
                } else if (fallbackAudioValue.startsWith('file://')) {
                  localUri = fallbackAudioValue;
                  console.log(
                    `✅ Found fallback file URI for attachment ${audioValue.slice(0, 8)}`
                  );
                  break;
                }
              }
            }
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
          } else {
            // Attachment ID not found in queue - try fallback to local table
            // This handles the edge case where server records were removed but local records remain
            console.log(
              `⚠️ Attachment ID ${audioValue.slice(0, 8)} not found in queue, checking local table fallback...`
            );

            // First try to find local link with same ID (most reliable match)
            let fallbackLocalLink = localLinks.find(
              (link) => link.id === contentLink.id
            );

            // If not found by ID, try to find by asset_id and created_at (same content link)
            if (!fallbackLocalLink) {
              fallbackLocalLink = localLinks.find(
                (link) =>
                  link.asset_id === contentLink.asset_id &&
                  link.created_at === contentLink.created_at
              );
            }

            // If still not found, use any unused local link for this asset (last resort)
            // This ensures we get some audio even if exact match fails
            if (!fallbackLocalLink && localLinks.length > 0) {
              // Find first unused local link
              fallbackLocalLink = localLinks.find(
                (link) => !usedLocalLinkIds.has(link.id)
              );
              if (fallbackLocalLink) {
                usedLocalLinkIds.add(fallbackLocalLink.id);
                console.log(
                  `⚠️ Using local link ${fallbackLocalLink.id.slice(0, 8)} as fallback for asset ${contentLink.asset_id}`
                );
              }
            } else if (fallbackLocalLink) {
              // Mark this local link as used to avoid duplicates
              usedLocalLinkIds.add(fallbackLocalLink.id);
            }

            if (fallbackLocalLink?.audio) {
              // Find any local URI in the fallback link
              for (const fallbackAudioValue of fallbackLocalLink.audio) {
                if (fallbackAudioValue.startsWith('local/')) {
                  localUri =
                    await getLocalAttachmentUriWithOPFS(fallbackAudioValue);
                  console.log(
                    `✅ Found fallback local URI for attachment ${audioValue.slice(0, 8)}`
                  );
                  break;
                } else if (fallbackAudioValue.startsWith('file://')) {
                  localUri = fallbackAudioValue;
                  console.log(
                    `✅ Found fallback file URI for attachment ${audioValue.slice(0, 8)}`
                  );
                  break;
                }
              }
            }
          }
        }

        // Verify file exists before adding
        if (localUri && (await fileExists(localUri))) {
          audioUris.push(localUri);
        } else if (localUri) {
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
  // Check if we're on web platform
  if (Platform.OS === 'web') {
    throw new Error(
      'Audio concatenation is not available on web. Please use a native device.'
    );
  }

  // Check if native module is available
  if (!concatAudioFiles || !convertToM4a) {
    throw new Error(
      'Audio concatenation module is not available. Please ensure react-native-audio-concat is properly installed.'
    );
  }

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

    // Fetch project, languoid, and user names for filename
    let projectName = '';
    let languoidName = '';
    let userName = '';

    // Get current user's username
    try {
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();
      const userId = session?.user.id;
      if (userId) {
        const profileData = await system.db
          .select({ username: profile.username })
          .from(profile)
          .where(eq(profile.id, userId))
          .limit(1);

        const profileRecord = profileData[0] as
          | { username: string | null }
          | undefined;
        if (profileRecord?.username) {
          userName = profileRecord.username;
        } else if (session.user.email) {
          // Fallback to email prefix if no username
          const emailPrefix = session.user.email.split('@')[0];
          if (emailPrefix) {
            userName = emailPrefix;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch username for filename:', error);
    }

    try {
      // Get quest to find project_id
      const questData = await system.db
        .select({ project_id: quest.project_id })
        .from(quest)
        .where(eq(quest.id, questId))
        .limit(1);

      const questRecord = questData[0] as
        | { project_id: string | null }
        | undefined;
      const projectId = questRecord?.project_id;
      if (projectId) {
        // Get project name
        const projectData = await system.db
          .select({ name: project.name })
          .from(project)
          .where(eq(project.id, projectId))
          .limit(1);

        const projectRecord = projectData[0] as
          | { name: string | null }
          | undefined;
        if (projectRecord?.name) {
          projectName = projectRecord.name;
        }

        // Get target languoid name
        const languoidLink = await system.db
          .select({ languoid_id: project_language_link.languoid_id })
          .from(project_language_link)
          .where(
            and(
              eq(project_language_link.project_id, projectId),
              eq(project_language_link.language_type, 'target'),
              isNotNull(project_language_link.languoid_id)
            )
          )
          .limit(1);

        const languoidLinkRecord = languoidLink[0] as
          | { languoid_id: string | null }
          | undefined;
        const languoidId = languoidLinkRecord?.languoid_id;
        if (languoidId) {
          const languoidData = await system.db
            .select({ name: languoid.name })
            .from(languoid)
            .where(eq(languoid.id, languoidId))
            .limit(1);

          const languoidRecord = languoidData[0] as
            | { name: string | null }
            | undefined;
          if (languoidRecord?.name) {
            languoidName = languoidRecord.name;
          }
        }
      }
    } catch (error) {
      console.warn(
        'Failed to fetch project/languoid names for filename:',
        error
      );
      // Continue with just quest name if fetch fails
    }

    // Create output file path (use native path format)
    // Use little-endian date format (DDMMYYYY)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    const dateStr = `${day}${month}${year}`; // DDMMYYYY format

    // Sanitize names for filename
    const sanitize = (name: string) =>
      name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    // Build filename parts: username-project-languoid-quest-date
    const parts: string[] = [];
    if (questName) parts.push(sanitize(questName));
    if (projectName) parts.push(sanitize(projectName));
    if (languoidName) parts.push(sanitize(languoidName));
    if (userName) parts.push(sanitize(userName));
    if (parts.length === 0) parts.push('quest');

    const outputFileName = `${parts.join('-')}-${dateStr}.m4a`;
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

    // Check if sharing is available on this platform
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Share the concatenated file using expo-sharing (works on both iOS and Android)
    await Sharing.shareAsync(outputPath, {
      mimeType: 'audio/mp4',
      UTI: 'com.apple.m4a-audio', // iOS-specific type identifier for M4A
      dialogTitle: questName || 'Quest Audio'
    });

    console.log('Audio share dialog opened successfully');
  } catch (error) {
    console.error('Failed to concatenate and share audio:', error);
    throw error;
  }
}
