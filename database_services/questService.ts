import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import type { DraftQuest } from '@/store/localStore';
import { quest } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

export type Quest = typeof quest.$inferSelect;
export type CreateQuestData = Omit<typeof quest.$inferInsert, 'id' | 'created_at' | 'last_updated' | 'active'>;

export class QuestService {
  async getQuestsByProjectId(project_id: string): Promise<Quest[]> {
    return db.select().from(quest).where(eq(quest.project_id, project_id));
  }

  async getQuestById(quest_id: string) {
    return (
      await db.select().from(quest).where(eq(quest.id, quest_id)).limit(1)
    )[0];
  }

  async createQuest(questData: CreateQuestData): Promise<Quest> {
    console.log('createQuest attempting to create quest:', questData);

    // Insert the quest
    const [newQuest] = await db.insert(quest).values({
      ...questData,
      download_profiles: questData.creator_id ? [questData.creator_id] : []
    }).returning();

    if (!newQuest) {
      throw new Error('Failed to create quest');
    }

    console.log('createQuest successfully created quest:', newQuest);
    return newQuest;
  }

  async createQuestFromDraft(draftQuest: DraftQuest, actualProjectId: string, creatorId: string): Promise<Quest> {
    const questData: CreateQuestData = {
      name: draftQuest.name,
      description: draftQuest.description,
      project_id: actualProjectId, // Use the real project ID, not the draft ID
      creator_id: creatorId,
      visible: draftQuest.visible
    };

    return this.createQuest(questData);
  }

  async createMultipleQuestsFromDrafts(draftQuests: DraftQuest[], actualProjectId: string, creatorId: string): Promise<Quest[]> {
    const createdQuests: Quest[] = [];

    for (const draftQuest of draftQuests) {
      const newQuest = await this.createQuestFromDraft(draftQuest, actualProjectId, creatorId);
      createdQuests.push(newQuest);
    }

    return createdQuests;
  }
}

export const questService = new QuestService();
