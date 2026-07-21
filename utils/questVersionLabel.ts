import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { parseQuestMetadata } from '@/database_services/questService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEST_VERSION_COUNTER_PREFIX = '@quest_version_counter:';

function buildCounterStorageKey(
  projectId: string,
  bookId: string,
  segmentId: string | number
): string {
  return `${QUEST_VERSION_COUNTER_PREFIX}${projectId}:${bookId}:${segmentId}`;
}

/**
 * Allocates the next local version label (#1, #2, …) for a Bible chapter or FIA
 * pericope within a project. Counter persists in AsyncStorage per
 * project + book + chapter/pericope.
 */
export async function allocateQuestVersionLabel(
  projectId: string,
  bookId: string,
  segmentId: string | number
): Promise<string> {
  const key = buildCounterStorageKey(projectId, bookId, segmentId);
  try {
    const raw = await AsyncStorage.getItem(key);
    const previous = raw ? Number.parseInt(raw, 10) : 0;
    const next = Number.isFinite(previous) && previous > 0 ? previous + 1 : 1;
    await AsyncStorage.setItem(key, String(next));
    return `#${next}`;
  } catch (error) {
    console.error('Failed to allocate quest version label:', error);
    return '#1';
  }
}

export function getQuestVersionLabel(metadata: unknown): string | null {
  const parsed = parseQuestMetadata(metadata);
  const label = parsed.bible?.versionLabel ?? parsed.fia?.versionLabel ?? null;
  if (!label) return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Breadcrumb / title label: "Genesis 1 · #1" when versionLabel exists. */
export function formatQuestDisplayLabel(
  name: string | null | undefined,
  metadata: unknown
): string {
  const base = name?.trim() || 'Quest';
  const versionLabel = getQuestVersionLabel(metadata);
  return versionLabel ? `${base} · ${versionLabel}` : base;
}

export function withBibleVersionLabel(
  metadata: QuestMetadata,
  versionLabel: string
): QuestMetadata {
  if (!metadata.bible) return metadata;
  return {
    ...metadata,
    bible: {
      ...metadata.bible,
      versionLabel
    }
  };
}

export function withFiaVersionLabel(
  metadata: QuestMetadata,
  versionLabel: string
): QuestMetadata {
  if (!metadata.fia) return metadata;
  return {
    ...metadata,
    fia: {
      ...metadata.fia,
      versionLabel
    }
  };
}
