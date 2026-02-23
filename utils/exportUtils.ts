import { projectService } from '@/database_services/projectService';
import { escapeCsvField } from '@/utils/backupUtils';
import {
    concatenateAudioListToFile,
    getQuestAudioUrisByAssetList
} from '@/utils/localAudioConcat';
import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface ExportArtifact {
  uri: string;
  name: string;
  mimeType: string;
}

export interface BuildExportArtifactsOptions {
  questId: string;
  projectId: string;
  assetIds: string[];
  questName?: string;
  mergedFile?: boolean;
  includeCsvFile?: boolean;
}

export interface BuiltExportArtifacts {
  files: ExportArtifact[];
  cleanup: () => Promise<void>;
}

export interface ExportAssetsCSVItem {
  assetName: string | null;
  metadata: unknown;
  segmentOrder: number;
  newFileName?: string;
}

export interface AndroidDownloadResult {
  directoryUri: string;
  savedFiles: {
    sourceUri: string;
    targetUri: string;
    name: string;
  }[];
}

function getFileNameFromUri(uri: string, fallbackPrefix = 'export'): string {
  const rawName = uri.split('/').pop();
  if (!rawName) {
    return `${fallbackPrefix}-${Date.now()}`;
  }
  return decodeURIComponent(rawName);
}

function getMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'application/octet-stream';
}

function sanitizeNamePart(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'asset';
  return trimmed
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatCurrentDateTime(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function getVerseSuffix(metadata: unknown): string | null {
  const parsed = parseMetadata(metadata);
  const verse = parsed?.verse as { from?: unknown; to?: unknown } | undefined;
  if (!verse) return null;

  const from = verse.from;
  const to = verse.to;
  if (from == null || to == null) return null;
  if (
    (typeof from !== 'string' && typeof from !== 'number') ||
    (typeof to !== 'string' && typeof to !== 'number')
  ) {
    return null;
  }

  const fromText = sanitizeNamePart(`${from}`);
  const toText = sanitizeNamePart(`${to}`);
  if (!fromText || !toText) return null;

  return `v${fromText}-${toText}`;
}

function ensureUniqueFileNames(files: ExportArtifact[]): ExportArtifact[] {
  const counterByName = new Map<string, number>();

  return files.map((file) => {
    const currentCount = counterByName.get(file.name) ?? 0;
    counterByName.set(file.name, currentCount + 1);

    if (currentCount === 0) {
      return file;
    }

    const dotIndex = file.name.lastIndexOf('.');
    const hasExt = dotIndex > 0;
    const baseName = hasExt ? file.name.slice(0, dotIndex) : file.name;
    const ext = hasExt ? file.name.slice(dotIndex) : '';

    return {
      ...file,
      name: `${baseName} (${currentCount + 1})${ext}`
    };
  });
}

export async function generateExportAssetsCSVFile(
  items: ExportAssetsCSVItem[],
  fileNamePrefix = 'export-assets'
): Promise<ExportArtifact> {
  const header = ['Asset Name', 'Metadata', 'Segment Order', 'fileName'].join(
    ','
  );

  const rows = items.map((item) => {
    const metadataText =
      item.metadata == null
        ? ''
        : typeof item.metadata === 'string'
          ? item.metadata
          : JSON.stringify(item.metadata);

    return [
      escapeCsvField(item.assetName ?? ''),
      escapeCsvField(metadataText),
      escapeCsvField(String(item.segmentOrder)),
      escapeCsvField(item.newFileName ?? '')
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\n');
  const dateTime = formatCurrentDateTime(new Date());
  const safePrefix = sanitizeNamePart(fileNamePrefix || 'export-assets');
  const csvName = `${safePrefix}-${dateTime}.csv`;
  const csvUri = `${FileSystem.cacheDirectory}${csvName}`;

  await FileSystem.writeAsStringAsync(csvUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8
  });

  return {
    uri: csvUri,
    name: csvName,
    mimeType: 'text/csv'
  };
}

export async function buildExportArtifacts({
  questId,
  projectId,
  assetIds,
  questName,
  mergedFile = true,
  includeCsvFile = false
}: BuildExportArtifactsOptions): Promise<BuiltExportArtifacts> {
  if (!assetIds.length) {
    throw new Error('No assets selected for export.');
  }

  const projectWithLanguoid =
    await projectService.getProjectWithRelatedLanguoid(projectId);
  const resolvedProjectName = projectWithLanguoid?.project.name || undefined;
  const resolvedLanguoidName = projectWithLanguoid?.languoid?.name || undefined;

  let files: ExportArtifact[] = [];
  let cleanupTargets: string[] = [];
  const currentDateTime = formatCurrentDateTime(new Date());
  if (mergedFile) {
    const { outputPath: audioUri, audioItems } = await concatenateAudioListToFile(
      questId,
      assetIds,
      questName,
      resolvedProjectName,
      resolvedLanguoidName
    );
    const fileName = getFileNameFromUri(audioUri, 'quest-audio');

    files = [
      {
        uri: audioUri,
        name: fileName,
        mimeType: 'audio/mp4'
      }
    ];

    if (includeCsvFile) {                 
      const csvFile = await generateExportAssetsCSVFile(audioItems, `${questName}-${resolvedProjectName}-${resolvedLanguoidName}`);
      files.push(csvFile);
    }   
    // Merged export generates a temporary artifact in cache.
    cleanupTargets = [audioUri];
  } else {
    const audioItems = await getQuestAudioUrisByAssetList(assetIds);
    if (!audioItems.length) {
      throw new Error('No audio files found for the selected assets.');
    }

    type AudioItemWithNewFileName = (typeof audioItems)[number] & {
      newFileName?: string;
    };

    files = audioItems.map((rawItem, index) => {
      const item = rawItem as AudioItemWithNewFileName;
      const originalName = getFileNameFromUri(item.uri, `audio-${index + 1}.m4a`);
      const extRegex = /(\.[a-zA-Z0-9]+)$/;
      const extMatch = extRegex.exec(originalName);
      const ext = extMatch?.[1] ?? '.m4a';
      const counter = String(index + 1).padStart(4, '0');
      const safeQuestName = sanitizeNamePart(questName || 'quest');
      const safeProjectName = resolvedProjectName
        ? sanitizeNamePart(resolvedProjectName)
        : null;
      const safeLanguoidName = resolvedLanguoidName
        ? sanitizeNamePart(resolvedLanguoidName)
        : null;
      const safeAssetName = sanitizeNamePart(item.assetName ?? `asset-${item.assetId}`);
      const verseSuffix = getVerseSuffix(item.metadata);
      const nameParts = [
        safeQuestName,
        safeProjectName,
        safeLanguoidName,
        counter,
        verseSuffix,
        safeAssetName,
        `seg${String(item.segmentOrder).padStart(2, '0')}`,
        currentDateTime
      ].filter((part): part is string => Boolean(part));
      const fileName = `${nameParts.join('-')}${ext}`;
      item.newFileName = fileName;
      return {
        uri: item.uri,
        name: fileName,
        mimeType: getMimeTypeFromFileName(fileName)
      };
    });

    if (includeCsvFile) {
        const csvFile = await generateExportAssetsCSVFile(audioItems, `${questName}-${resolvedProjectName}-${resolvedLanguoidName}`);
        files.push(csvFile);
    }
  }


  files = ensureUniqueFileNames(files);

  return {
    files,
    cleanup: async () => {
      await Promise.all(
        cleanupTargets.map(async (uri) => {
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch (error) {
            console.warn(`[exportUtils] Failed to cleanup ${uri}:`, error);
          }
        })
      );
    }
  };
}

export async function shareExport(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  dialogTitle = 'Share export'
): Promise<void> {
  if (artifacts.files.length > 1) {
    throw new Error(
      'Sharing multiple files is not supported yet. Use Download for multiple files.'
    );
  }

  const [firstFile] = artifacts.files;
  if (!firstFile) {
    throw new Error('No files available to share.');
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(firstFile.uri, {
    mimeType: firstFile.mimeType,
    UTI: firstFile.mimeType === 'audio/mp4' ? 'com.apple.m4a-audio' : undefined,
    dialogTitle
  });
}

export async function downloadExportAndroid(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  directoryUri?: string
): Promise<AndroidDownloadResult> {
  if (Platform.OS !== 'android') {
    throw new Error('downloadExportAndroid can only be called on Android.');
  }

  let targetDirectory = directoryUri;
  if (!targetDirectory) {
    const permission =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted || !permission.directoryUri) {
      throw new Error('Directory permission was not granted.');
    }
    targetDirectory = permission.directoryUri;
  }

  const savedFiles: AndroidDownloadResult['savedFiles'] = [];

  for (const file of artifacts.files) {
    const fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64
    });

    const targetUri = await StorageAccessFramework.createFileAsync(
      targetDirectory,
      file.name,
      file.mimeType
    );

    await FileSystem.writeAsStringAsync(targetUri, fileBase64, {
      encoding: FileSystem.EncodingType.Base64
    });

    savedFiles.push({
      sourceUri: file.uri,
      targetUri,
      name: file.name
    });
  }

  return {
    directoryUri: targetDirectory,
    savedFiles
  };
}

export async function downloadExportIOS(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  dialogTitle = 'Save export'
): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('downloadExportIOS can only be called on iOS.');
  }

  // iOS does not allow unrestricted writes to arbitrary folders from app code.
  // We rely on the native share sheet so users can choose "Save to Files".
  await shareExport(artifacts, dialogTitle);
}

export async function downloadExport(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  options?: { androidDirectoryUri?: string; iosDialogTitle?: string }
): Promise<AndroidDownloadResult | void> {
  if (Platform.OS === 'android') {
    return downloadExportAndroid(artifacts, options?.androidDirectoryUri);
  }

  if (Platform.OS === 'ios') {
    return downloadExportIOS(artifacts, options?.iosDialogTitle);
  }

  throw new Error('Download export is only supported on Android and iOS.');
}
