import type { ChapterVerse } from '@/constants/bibleStructure';
import { projectService } from '@/database_services/projectService';
import { questService } from '@/database_services/questService';
import { escapeCsvField } from '@/utils/backupUtils';
import {
    concatenateAudioListToFile,
    getQuestAudioUrisByAssetList
} from '@/utils/localAudioConcat';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share as NativeShare, Platform } from 'react-native';
import {
    ensureUniqueFileNames,
    formatCurrentDateTime,
    getFIAVerseSuffix,
    getMetadataVerseForCsv,
    getMetadataVerseForFiaCsv,
    getMimeTypeFromFileName,
    getUniqueFileName,
    getVerseSuffix,
    isUserCancellationError,
    sanitizeNamePart
} from './exportNaming';
import { getFiaSequenceFromQuestMetadata } from './fiaUtils';

async function getZipArchive() {
  const { zip } = await import('react-native-zip-archive');
  return zip;
}

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
  zipFile?: boolean;
}

export interface BuiltExportArtifacts {
  files: ExportArtifact[];
  cleanup: () => Promise<void>;
}

export interface ExportAssetsCSVItem {
  assetName: string | null;
  metadata: unknown;
  segmentOrder: number;
  text?: string | null;
  languoidName?: string | null;
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

export type ExportActionResult = 'completed' | 'cancelled';

function getFileNameFromUri(uri: string, fallbackPrefix = 'export'): string {
  const rawName = uri.split('/').pop();
  if (!rawName) {
    return `${fallbackPrefix}-${Date.now()}`;
  }
  return decodeURIComponent(rawName);
}

function normalizeFileSystemUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return uri;
}

function joinUri(baseUri: string, fileName: string): string {
  return `${baseUri.replace(/\/+$/, '')}/${fileName}`;
}

function getCacheUri(fileName: string): string {
  return joinUri(Paths.cache.uri, fileName);
}

async function deleteUriIfExists(uri: string): Promise<void> {
  const normalizedUri = normalizeFileSystemUri(uri);
  try {
    const file = new File(normalizedUri);
    if (file.exists) {
      file.delete();
      return;
    }
  } catch {
    // Ignore and try as directory.
  }

  try {
    const directory = new Directory(normalizedUri);
    if (directory.exists) {
      directory.delete();
    }
  } catch {
    // Ignore cleanup failures.
  }
}

async function compressFiles(options: {
  files: ExportArtifact[];
  currentDateTime: string;
  questName?: string;
  resolvedProjectName?: string;
  resolvedLanguoidName?: string;
}): Promise<{ files: ExportArtifact[]; cleanupTargets: string[] }> {
  const {
    files,
    currentDateTime,
    questName,
    resolvedProjectName,
    resolvedLanguoidName
  } = options;

  const zipNameBase = sanitizeNamePart(
    `${questName || 'quest'}-${resolvedProjectName || 'project'}-${
      resolvedLanguoidName || 'export'
    }`
  );
  const zipFileName = `${zipNameBase || 'export'}-${currentDateTime}.zip`;
  const stagingDir = new Directory(
    Paths.cache,
    `export-zip-staging-${Date.now()}`
  );
  const zipOutputPath = getCacheUri(zipFileName);
  if (!stagingDir.exists) {
    stagingDir.create({ intermediates: true });
  }

  try {
    await Promise.all(
      files.map(async (file) => {
        const sourceFile = new File(normalizeFileSystemUri(file.uri));
        sourceFile.copy(new File(stagingDir, file.name));
      })
    );

    const zipFn = await getZipArchive();
    const zipUri = normalizeFileSystemUri(
      await zipFn(
        normalizeFileSystemUri(stagingDir.uri),
        normalizeFileSystemUri(zipOutputPath)
      )
    );

    return {
      files: [
        {
          uri: zipUri,
          name: zipFileName,
          mimeType: 'application/zip'
        }
      ],
      cleanupTargets: [zipUri, stagingDir.uri]
    };
  } catch (error) {
    await deleteUriIfExists(stagingDir.uri);
    throw error;
  }
}

async function generateExportAssetsCSVFile(
  items: ExportAssetsCSVItem[],
  fileNamePrefix = 'export-assets',
  projectTemplate?: string | null,
  fiaSequence?: ChapterVerse[] | null
): Promise<ExportArtifact> {
  const header = [
    'Asset Name',
    'Metadata',
    'Segment Order',
    'Text',
    'Languoid Name',
    'fileName'
  ].join(',');

  const rows = items.map((item) => {
    const metadataText =
      projectTemplate === 'fia' && fiaSequence
        ? getMetadataVerseForFiaCsv(item.metadata, fiaSequence)
        : projectTemplate === 'bible'
          ? getMetadataVerseForCsv(item.metadata)
          : '';
    return [
      escapeCsvField(item.assetName ?? ''),
      escapeCsvField(metadataText),
      escapeCsvField(String(item.segmentOrder)),
      escapeCsvField(item.text ?? ''),
      escapeCsvField(item.languoidName ?? ''),
      escapeCsvField(item.newFileName ?? '')
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\n');
  const dateTime = formatCurrentDateTime(new Date());
  const safePrefix = sanitizeNamePart(fileNamePrefix || 'export-assets');
  const csvName = `${safePrefix}-${dateTime}.csv`;
  const csvUri = getCacheUri(csvName);
  const csvFile = new File(csvUri);
  csvFile.write(csvContent);

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
  includeCsvFile = false,
  zipFile = false
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

  let fiaSequence: ChapterVerse[] | null = null;
  if (projectWithLanguoid?.project.template === 'fia' && questId) {
    const quest = (await questService.getQuestById(questId)) as
      | { metadata?: unknown }
      | undefined;
    fiaSequence = getFiaSequenceFromQuestMetadata(quest?.metadata);
  }

  if (mergedFile) {
    const { outputPath: audioUri, audioItems } =
      await concatenateAudioListToFile(
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
      const csvFile = await generateExportAssetsCSVFile(
        audioItems,
        `${questName}-${resolvedProjectName}-${resolvedLanguoidName}`,
        projectWithLanguoid?.project.template,
        fiaSequence
      );
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
      const originalName = getFileNameFromUri(
        item.uri,
        `audio-${index + 1}.m4a`
      );
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
      const safeAssetName = sanitizeNamePart(
        item.assetName ?? `asset-${item.assetId}`
      );
      const verseSuffix =
        projectWithLanguoid?.project.template === 'fia'
          ? getFIAVerseSuffix(item.metadata, fiaSequence)
          : getVerseSuffix(item.metadata);
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
      const csvFile = await generateExportAssetsCSVFile(
        audioItems,
        `${questName}-${resolvedProjectName}-${resolvedLanguoidName}`,
        projectWithLanguoid?.project.template,
        fiaSequence
      );
      files.push(csvFile);
    }
  }

  files = ensureUniqueFileNames(files);

  if (files.length > 1 && Platform.OS !== 'android') {
    zipFile = true;
  }

  if (zipFile) {
    const compressed = await compressFiles({
      files,
      currentDateTime,
      questName,
      resolvedProjectName,
      resolvedLanguoidName
    });
    files = compressed.files;
    cleanupTargets = [...cleanupTargets, ...compressed.cleanupTargets];
  }

  return {
    files,
    cleanup: async () => {
      await Promise.all(
        cleanupTargets.map(async (uri) => {
          try {
            await deleteUriIfExists(uri);
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
): Promise<ExportActionResult> {
  if (artifacts.files.length > 1) {
    throw new Error(
      'Sharing multiple files is not supported yet. Use Download for multiple files.'
    );
  }

  const [firstFile] = artifacts.files;
  if (!firstFile) {
    throw new Error('No files available to share.');
  }

  const sourceUri = normalizeFileSystemUri(firstFile.uri);
  const currentFileName = getFileNameFromUri(sourceUri, 'export');
  const targetFileName = firstFile.name || currentFileName;

  let shareUri = sourceUri;
  let tempShareUri: string | null = null;

  // iOS share sheet uses the source URI filename. If needed, create a temp copy
  // with the intended export name so users see the expected filename.
  if (Platform.OS === 'ios' && currentFileName !== targetFileName) {
    tempShareUri = getCacheUri(`share-${Date.now()}-${targetFileName}`);
    const sourceFile = new File(sourceUri);
    sourceFile.copy(new File(tempShareUri));
    shareUri = tempShareUri;
  }

  try {
    if (Platform.OS === 'ios') {
      const result = await NativeShare.share({
        url: shareUri,
        title: dialogTitle
      });
      return result.action === NativeShare.dismissedAction
        ? 'cancelled'
        : 'completed';
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device.');
    }

    await Sharing.shareAsync(shareUri, {
      mimeType: firstFile.mimeType,
      UTI:
        firstFile.mimeType === 'audio/mp4' ? 'com.apple.m4a-audio' : undefined,
      dialogTitle
    });
    return 'completed';
  } finally {
    if (tempShareUri) {
      await deleteUriIfExists(tempShareUri);
    }
  }
}

async function downloadExportAndroid(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  directoryUri?: string
): Promise<AndroidDownloadResult | ExportActionResult> {
  if (Platform.OS !== 'android') {
    throw new Error('downloadExportAndroid can only be called on Android.');
  }

  let targetDirectory = directoryUri;
  if (!targetDirectory) {
    try {
      const pickedDirectory = await Directory.pickDirectoryAsync();
      if (!pickedDirectory?.uri) {
        return 'cancelled';
      }
      targetDirectory = pickedDirectory.uri;
    } catch (error) {
      if (isUserCancellationError(error)) {
        return 'cancelled';
      }
      throw error;
    }
  }

  const savedFiles: AndroidDownloadResult['savedFiles'] = [];
  const targetDirectoryRef = new Directory(targetDirectory);
  const existingNames = new Set(
    targetDirectoryRef.list().map((entry) => entry.name)
  );

  for (const file of artifacts.files) {
    const sourceFile = new File(normalizeFileSystemUri(file.uri));
    const fileBase64 = await sourceFile.base64();
    const safeTargetName = getUniqueFileName(file.name, existingNames);
    const targetFile = targetDirectoryRef.createFile(
      safeTargetName,
      file.mimeType || 'application/octet-stream'
    );
    targetFile.write(fileBase64, { encoding: 'base64' });
    existingNames.add(safeTargetName);

    savedFiles.push({
      sourceUri: file.uri,
      targetUri: targetFile.uri,
      name: safeTargetName
    });
  }

  return {
    directoryUri: targetDirectory,
    savedFiles
  };
}

async function downloadExportIOS(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  dialogTitle = 'Save export'
): Promise<ExportActionResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('downloadExportIOS can only be called on iOS.');
  }

  // iOS does not allow unrestricted writes to arbitrary folders from app code.
  // We rely on the native share sheet so users can choose "Save to Files".
  return shareExport(artifacts, dialogTitle);
}

export async function downloadExport(
  artifacts: Pick<BuiltExportArtifacts, 'files'>,
  options?: { androidDirectoryUri?: string; iosDialogTitle?: string }
): Promise<AndroidDownloadResult | ExportActionResult> {
  if (Platform.OS === 'android') {
    return downloadExportAndroid(artifacts, options?.androidDirectoryUri);
  }

  if (Platform.OS === 'ios') {
    return downloadExportIOS(artifacts, options?.iosDialogTitle);
  }

  throw new Error('Download export is only supported on Android and iOS.');
}
