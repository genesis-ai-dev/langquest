import { fileExists, normalizeFileUri } from '@/utils/fileUtils';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

type ConvertToM4a = (inputPath: string, outputPath: string) => Promise<string>;

let convertToM4a: ConvertToM4a | undefined;

if (Platform.OS !== 'web') {
  try {
    const audioConcatModule = require('react-native-audio-concat');
    convertToM4a = audioConcatModule.convertToM4a as ConvertToM4a;
  } catch (error) {
    console.warn('Failed to load react-native-audio-concat:', error);
  }
}

function getNativePath(uri: string): string {
  const normalized = normalizeFileUri(uri);
  return normalized.startsWith('file://')
    ? normalized.replace(/^file:\/\//, '')
    : normalized;
}

/**
 * Convert a local WAV file URI to M4A.
 * If conversion is unavailable or fails, returns the original URI.
 */
export async function convertWavUriToM4a(uri: string): Promise<string> {
  const normalizedUri = normalizeFileUri(uri);
  if (!normalizedUri.toLowerCase().endsWith('.wav')) {
    return normalizedUri;
  }

  if (Platform.OS === 'web' || !convertToM4a) {
    return normalizedUri;
  }

  if (!fileExists(normalizedUri)) {
    return normalizedUri;
  }

  const outputUri = `${Paths.cache.uri}/vad_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.m4a`;

  try {
    const convertedPath = await convertToM4a(
      getNativePath(normalizedUri),
      getNativePath(outputUri)
    );
    const convertedUri = normalizeFileUri(
      convertedPath.startsWith('file://')
        ? convertedPath
        : `file://${convertedPath}`
    );

    if (fileExists(convertedUri)) {
      return convertedUri;
    }

    return normalizedUri;
  } catch (error) {
    console.warn('Failed to convert WAV to M4A:', error);
    return normalizedUri;
  }
}
