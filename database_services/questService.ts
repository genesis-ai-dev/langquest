import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { resolveTable } from '@/utils/dbUtils';
import uuid from 'react-native-uuid';
import { quest } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

const MAX_RECORDING_SESSIONS = 10;

export type Quest = typeof quest.$inferSelect;

export class QuestService {
  async getQuestsByProjectId(project_id: string): Promise<Quest[]> {
    return db.select().from(quest).where(eq(quest.project_id, project_id));
  }

  async getQuestById(quest_id: string) {
    return (
      await db.select().from(quest).where(eq(quest.id, quest_id)).limit(1)
    )[0];
  }
}

export const questService = new QuestService();

export async function updateQuestMetadata(
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

function parseQuestMetadata(rawMetadata: unknown): QuestMetadata {
  if (!rawMetadata) return {};
  if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata);
      return parsed && typeof parsed === 'object' ? (parsed as QuestMetadata) : {};
    } catch {
      return {};
    }
  }
  return typeof rawMetadata === 'object' ? (rawMetadata as QuestMetadata) : {};
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