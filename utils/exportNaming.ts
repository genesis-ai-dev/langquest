import type { ChapterVerse } from '@/constants/bibleStructure';
import { formatPericopeVerseLabel } from '@/constants/bibleStructure';

export function isUserCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('cancel') ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('aborted')
  );
}

export function getMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'application/octet-stream';
}

export function getUniqueFileName(
  desiredName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(desiredName)) {
    return desiredName;
  }

  const dotIndex = desiredName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? desiredName.slice(0, dotIndex) : desiredName;
  const extension = hasExtension ? desiredName.slice(dotIndex) : '';

  let counter = 2;
  let candidate = `${baseName} (${counter})${extension}`;
  while (existingNames.has(candidate)) {
    counter += 1;
    candidate = `${baseName} (${counter})${extension}`;
  }
  return candidate;
}

export function sanitizeNamePart(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'asset';
  return trimmed
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatCurrentDateTime(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function parseMetadata(
  metadata: unknown
): Record<string, unknown> | null {
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

export function getVerseSuffix(metadata: unknown): string | null {
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

export function parseVersePosition(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getFIAVerseSuffix(
  metadata: unknown,
  fiaSequence: ChapterVerse[] | null
): string | null {
  const parsed = parseMetadata(metadata);
  const verse = parsed?.verse as { from?: unknown; to?: unknown } | undefined;
  if (!verse) return null;

  const from = parseVersePosition(verse.from);
  const to = parseVersePosition(verse.to);
  if (from == null && to == null) return null;

  if (!fiaSequence || fiaSequence.length === 0) {
    return getVerseSuffix(metadata);
  }

  const fromLabel =
    from != null ? formatPericopeVerseLabel('', fiaSequence, from) : null;
  const toLabel =
    to != null ? formatPericopeVerseLabel('', fiaSequence, to) : null;

  if (fromLabel && toLabel) {
    const fromText = sanitizeNamePart(fromLabel);
    const toText = sanitizeNamePart(toLabel);
    if (!fromText || !toText) return null;
    return fromText === toText ? `v${fromText}` : `v${fromText}-${toText}`;
  }
  if (fromLabel) {
    const fromText = sanitizeNamePart(fromLabel);
    return fromText ? `v${fromText}` : null;
  }
  if (toLabel) {
    const toText = sanitizeNamePart(toLabel);
    return toText ? `v${toText}` : null;
  }

  return getVerseSuffix(metadata);
}

export function ensureUniqueFileNames<T extends { name: string }>(
  files: T[]
): T[] {
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

export function getMetadataVerseForCsv(metadata: unknown): string {
  const parsed = parseMetadata(metadata);
  const verse = parsed?.verse as
    | { from?: string | number; to?: string | number }
    | string
    | number
    | null
    | undefined;

  if (!verse) return '';

  if (typeof verse === 'string' || typeof verse === 'number') {
    return `${verse}`;
  }

  const from = verse.from;
  const to = verse.to;
  if (from != null && to != null) {
    return `v${from}-${to}`;
  }
  if (from != null) {
    return `v${from}`;
  }
  if (to != null) {
    return `v${to}`;
  }

  return '';
}

export function getMetadataVerseForFiaCsv(
  assetMetadata: unknown,
  fiaSequence: ChapterVerse[] | null
): string {
  const assetParsed = parseMetadata(assetMetadata);
  const verse = assetParsed?.verse as
    | { from?: unknown; to?: unknown }
    | undefined;
  if (!verse) return '';

  const from = parseVersePosition(verse.from);
  const to = parseVersePosition(verse.to);
  if (from == null && to == null) return '';

  if (!fiaSequence || fiaSequence.length === 0) {
    return getMetadataVerseForCsv(assetMetadata);
  }

  const fromLabel =
    from != null ? formatPericopeVerseLabel('', fiaSequence, from) : null;
  const toLabel =
    to != null ? formatPericopeVerseLabel('', fiaSequence, to) : null;

  if (fromLabel && toLabel) {
    return fromLabel === toLabel ? fromLabel : `${fromLabel}-${toLabel}`;
  }
  if (fromLabel) return fromLabel;
  if (toLabel) return toLabel;

  return getMetadataVerseForCsv(assetMetadata);
}
