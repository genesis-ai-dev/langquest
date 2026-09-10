import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { resolveTable } from '@/utils/dbUtils';
import { parseQuestMetadata } from '@/utils/questMetadata';
import uuid from 'react-native-uuid';
import { quest } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

const MAX_RECORDING_SESSIONS = 10;

export class QuestService {
  async getQuestById(quest_id: string) {
    return (
      await system.db.select().from(quest).where(eq(quest.id, quest_id)).limit(1)
    )[0];
  }
}

export const questService = new QuestService();

export { parseQuestMetadata } from '@/utils/questMetadata';

export async function updateQuestVersionLabel(
  quest_id: string,
  versionLabel: string,
  existingMetadata: unknown
): Promise<void> {
  const trimmed = versionLabel.trim();
  if (!trimmed) {
    throw new Error('Version label cannot be empty');
  }

  const parsed = parseQuestMetadata(existingMetadata);
  await updateQuestMetadata(quest_id, {
    ...parsed,
    versionLabel: trimmed
  });
}

async function updateQuestMetadata(
  quest_id: string,
  metadata: QuestMetadata
): Promise<void> {
  try {
    const questLocalTable = resolveTable('quest', { localOverride: true });
    const updatedRows = await system.db
      .update(questLocalTable)
      .set({ metadata })
      .where(eq(questLocalTable.id, quest_id))
      .returning({ id: questLocalTable.id });
    if (updatedRows.length === 0) {
      throw new Error('Quest not found');
    }
  } catch (error) {
    console.error('Failed to update quest metadata:', error);
    throw error;
  }
}

/**
 * Resolves the session id used to highlight assets recorded in the latest session.
 * Prefers the in-memory recording session while the quest query may still be stale.
 */
export function getEffectiveLastRecordingSessionId(
  questMetadata: unknown,
  activeRecordingSessionId?: string
): string | undefined {
  const parsed = parseQuestMetadata(questMetadata);
  return activeRecordingSessionId ?? parsed.lastRecordingSessionId;
}

export async function createQuestRecordingSession(
  quest_id: string
): Promise<string> {
  try {
    const questLocalTable = resolveTable('quest', { localOverride: true });
    const existingQuestRows = await system.db
      .select({
        metadata: questLocalTable.metadata
      })
      .from(questLocalTable)
      .where(eq(questLocalTable.id, quest_id))
      .limit(1);
    const existingQuest = existingQuestRows[0];

    if (!existingQuest) {
      throw new Error('Quest not found');
    }

    const existingMetadata = parseQuestMetadata(existingQuest.metadata);
    const recordingSessionId = String(uuid.v4());
    const nextRecordingSessions = [
      ...(existingMetadata.recordingSessions ?? []),
      {
        id: recordingSessionId,
        created_at: new Date().toISOString()
      }
    ].slice(-MAX_RECORDING_SESSIONS);

    const updatedMetadata: QuestMetadata = {
      ...existingMetadata,
      lastRecordingSessionId: recordingSessionId,
      recordingSessions: nextRecordingSessions
    };

    console.log('[updatedMetadata]', updatedMetadata);

    await updateQuestMetadata(quest_id, updatedMetadata);
    return recordingSessionId;
  } catch (error) {
    console.error('Failed to create quest recording session:', error);
    throw error;
  }
}
