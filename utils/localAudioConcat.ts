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
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { resolveTable } from '@/utils/dbUtils';
import { fileExists, normalizeFileUri } from '@/utils/fileUtils';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';
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
 * - First resolves each audio value to its deterministic on-disk location
 * - If the file is not on disk, falls back to the local table
 * - This handles edge case where server records were removed but local records remain
 */
async function getQuestAudioUris(questId: string): Promise<string[]> {
  // Get all asset IDs for this quest, excluding translations (where source_asset_id is not null)
  const questAssetLinks = await system.db
    .select({ asset_id: quest_asset_link.asset_id })
    .from(quest_asset_link)
    .innerJoin(asset, eq(quest_asset_link.asset_id, asset.id))
    .where(
      and(
        eq(quest_asset_link.quest_id, questId),
        isNull(asset.source_asset_id) // Exclude translations
      )
    );

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

  // Create a map of local content links by asset_id for quick lookup
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
  // Order by asset order_index and content order_index to maintain proper sequence
  const audioUris: string[] = [];

  // Get assets with order_index to maintain proper sequence
  // Join with asset table to get order_index
  // Exclude translations (where source_asset_id is not null)
  const assetsWithOrder = await system.db
    .select({
      asset_id: quest_asset_link.asset_id,
      order_index: asset.order_index
    })
    .from(quest_asset_link)
    .innerJoin(asset, eq(quest_asset_link.asset_id, asset.id))
    .where(
      and(
        eq(quest_asset_link.quest_id, questId),
        isNull(asset.source_asset_id) // Exclude translations
      )
    )
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
    // Sort by order_index to maintain segment order
    const allLinks = [...syncedLinks, ...localLinks];
    allLinks.sort((a, b) => {
      const aOrder = a.order_index ?? 0;
      const bOrder = b.order_index ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Fallback to created_at for duplicate order_index values
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

    // Deduplicate by ID first (prefer synced over local)
    const seenIds = new Set<string>();
    const linksById = allLinks.filter((link) => {
      if (seenIds.has(link.id)) {
        return false;
      }
      seenIds.add(link.id);
      return true;
    });

    // Also deduplicate by asset_id + created_at to catch cases where
    // synced and local links have different IDs but represent the same content
    const seenByContent = new Set<string>();
    const uniqueLinks = linksById.filter((link) => {
      const contentKey = `${link.asset_id}-${link.created_at || ''}`;
      if (seenByContent.has(contentKey)) {
        return false;
      }
      seenByContent.add(contentKey);
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

        let localUri: string | null = await resolveExistingAudioUri(audioValue);

        if (!localUri) {
          // Fall back to the local (unsynced) table: the same content may
          // carry a different audio value whose file is still on disk.
          let fallbackLocalLink =
            localLinks.find((link) => link.id === contentLink.id) ??
            localLinks.find(
              (link) =>
                link.asset_id === contentLink.asset_id &&
                link.created_at === contentLink.created_at
            );

          // Last resort: any unused local link for this asset, so we still
          // get some audio even if an exact match fails
          if (!fallbackLocalLink && localLinks.length > 0) {
            fallbackLocalLink = localLinks.find(
              (link) => !usedLocalLinkIds.has(link.id)
            );
          }
          if (fallbackLocalLink) {
            usedLocalLinkIds.add(fallbackLocalLink.id);
          }

          if (fallbackLocalLink?.audio) {
            for (const fallbackAudioValue of fallbackLocalLink.audio) {
              const fallbackUri =
                await resolveExistingAudioUri(fallbackAudioValue);
              if (fallbackUri) {
                localUri = fallbackUri;
                console.log(
                  `✅ Found fallback audio for ${audioValue.slice(0, 20)}`
                );
                break;
              }
            }
          }
        }

        if (localUri) {
          // Normalize URI for comparison to avoid duplicates
          const normalizedUri = normalizeFileUri(localUri);
          // Check if this URI is already in the array to prevent duplicates
          if (
            !audioUris.some((uri) => normalizeFileUri(uri) === normalizedUri)
          ) {
            audioUris.push(localUri);
          } else {
            console.log(
              `Skipping duplicate audio URI: ${normalizedUri.slice(0, 50)}...`
            );
          }
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
        const cacheUri = Paths.cache.uri;
        const tempM4aPath = `${cacheUri}/temp_${Date.now()}_${i}.m4a`;
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
    const cacheDir = Paths.cache.uri;
    const outputPath = `${cacheDir}/${outputFileName}`;
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
        const file = new File(tempFile);
        if (file.exists) {
          file.delete();
        }
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

/** ONLY WORKS FOR LOCAL ASSETS **/
export interface QuestAudioAssetItem {
  assetId: string;
  assetOrderIndex: number;
  assetName: string | null;
  text: string | null;
  metadata: unknown;
  languoidName: string | null;
  segmentOrder: number;
  uri: string;
  newFileName?: string;
  createdAt: string | null;
}

export interface ConcatenateAudioListResult {
  outputPath: string;
  audioItems: QuestAudioAssetItem[];
}

export async function getQuestAudioUrisByAssetList(
  assetIds: string[]
): Promise<QuestAudioAssetItem[]> {
  if (assetIds.length === 0) {
    return [];
  }

  // Query assets with their content links and languoid info in a single query
  const assets = await system.db.query.asset.findMany({
    columns: {
      id: true,
      order_index: true,
      name: true,
      metadata: true
    },
    where: inArray(asset.id, assetIds),
    with: {
      content: {
        columns: {
          id: true,
          asset_id: true,
          audio: true,
          order_index: true,
          created_at: true,
          text: true,
          source: true
        },
        with: {
          languoid: true
        },
        where: (content, { isNotNull }) => isNotNull(content.audio),
        orderBy: (content) => [
          asc(content.order_index),
          asc(content.created_at)
        ]
      }
    },
    orderBy: [asc(asset.order_index), asc(asset.created_at)]
  });

  // Deduplicate assets by ID (first wins, synced preferred as it comes first)
  const seenAssetIds = new Set<string>();
  const dedupedAssets = assets.filter((assetItem) => {
    if (seenAssetIds.has(assetItem.id)) {
      return false;
    }
    seenAssetIds.add(assetItem.id);
    return true;
  });

  // Deduplicate content links within each asset by ID (prefer synced over local)
  for (const assetItem of dedupedAssets) {
    if (!assetItem.content) continue;

    const seenContentIds = new Set<string>();
    assetItem.content = assetItem.content.filter((contentLink) => {
      if (seenContentIds.has(contentLink.id)) {
        return false;
      }
      seenContentIds.add(contentLink.id);
      return true;
    });
  }

  const output: QuestAudioAssetItem[] = [];
  const seenKeys = new Set<string>();

  // Assets are already sorted by the database query (orderBy: order_index, created_at)
  for (const assetItem of dedupedAssets) {
    const assetLinks = assetItem.content ?? [];

    for (const contentLink of assetLinks) {
      if (!contentLink.audio?.length) continue;

      for (const audioValue of contentLink.audio) {
        if (typeof audioValue !== 'string' || !audioValue) continue;

        const localUri = await resolveExistingAudioUri(audioValue);
        if (!localUri) {
          continue;
        }

        const normalizedUri = normalizeFileUri(localUri);
        const dedupeKey = `${assetItem.id}:${contentLink.order_index || 0}:${normalizedUri}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        output.push({
          assetId: assetItem.id,
          assetOrderIndex: assetItem.order_index ?? 0,
          assetName: assetItem.name ?? null,
          text: contentLink.text ?? null,
          metadata: assetItem.metadata ?? null,
          languoidName: contentLink.languoid?.name ?? null,
          segmentOrder: contentLink.order_index || 0,
          uri: localUri,
          createdAt: contentLink.created_at
        });
      }
    }
  }

  return output;
}

export async function concatenateAudioListToFile(
  questId: string,
  assetIds: string[],
  questName?: string,
  projectName?: string,
  languoidName?: string
): Promise<ConcatenateAudioListResult> {
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
    // Get audio URIs only for the selected assets
    const audioItems = await getQuestAudioUrisByAssetList(assetIds);
    const audioUris = audioItems.map((item) => item.uri);

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
        const cacheDir = Paths.cache.uri;
        const tempM4aPath = `${cacheDir}/temp_${Date.now()}_${i}.m4a`;
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
    let resolvedProjectName = projectName || '';
    let resolvedLanguoidName = languoidName || '';
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
        if (!resolvedProjectName) {
          // Get project name only when not provided by caller
          const projectData = await system.db
            .select({ name: project.name })
            .from(project)
            .where(eq(project.id, projectId))
            .limit(1);

          const projectRecord = projectData[0] as
            | { name: string | null }
            | undefined;
          if (projectRecord?.name) {
            resolvedProjectName = projectRecord.name;
          }
        }

        if (!resolvedLanguoidName) {
          // Get target languoid name only when not provided by caller
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
              resolvedLanguoidName = languoidRecord.name;
            }
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
    if (resolvedProjectName) parts.push(sanitize(resolvedProjectName));
    if (resolvedLanguoidName) parts.push(sanitize(resolvedLanguoidName));
    if (userName) parts.push(sanitize(userName));
    if (parts.length === 0) parts.push('quest');

    const outputFileName = `${parts.join('-')}-${dateStr}.m4a`;
    const cacheDir = Paths.cache.uri;
    const outputPath = `${cacheDir}/${outputFileName}`;
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
        const file = new File(tempFile);
        if (file.exists) {
          file.delete();
        }
      } catch (error) {
        console.warn(`Failed to delete temp file ${tempFile}:`, error);
      }
    }

    console.log(`Audio concatenated successfully: ${outputPath}`);

    return {
      outputPath,
      audioItems
    };
  } catch (error) {
    console.error('Failed to concatenate audio file:', error);
    throw error;
  }
}

export async function concatenateAndShareAudioList(
  questId: string,
  assetIds: string[],
  questName?: string
): Promise<void> {
  const { outputPath } = await concatenateAudioListToFile(
    questId,
    assetIds,
    questName
  );

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(outputPath, {
    mimeType: 'audio/mp4',
    UTI: 'com.apple.m4a-audio', // iOS-specific type identifier for M4A
    dialogTitle: questName || 'Quest Audio'
  });

  console.log('Audio share dialog opened successfully');
}
