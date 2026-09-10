import type { QuestMetadata } from '@/db/drizzleSchemaColumns';

export function parseQuestMetadata(rawMetadata: unknown): QuestMetadata {
  if (!rawMetadata) return {};
  if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata);
      return parsed && typeof parsed === 'object'
        ? (parsed as QuestMetadata)
        : {};
    } catch {
      return {};
    }
  }
  return typeof rawMetadata === 'object' ? (rawMetadata as QuestMetadata) : {};
}
