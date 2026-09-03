import {
  asset,
  languoid,
  profile,
  project,
  project_language_link,
  quest
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { fileExists, normalizeFileUri } from '@/utils/fileUtils';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
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

/** ONLY WORKS FOR LOCAL ASSETS **/
interface QuestAudioAssetItem {
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

interface ConcatenateAudioListResult {
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
