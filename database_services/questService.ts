import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { quest, tag, questToTags } from '../db/drizzleSchema';

export type QuestWithRelations = typeof quest.$inferSelect & {
  tags: (typeof tag.$inferSelect)[];
};

export class QuestService {
  async getQuestsByProjectId(projectId: string): Promise<QuestWithRelations[]> {
    const results = await db
      .select({
        id: quest.id,
        rev: quest.rev,
        createdAt: quest.createdAt,
        lastUpdated: quest.lastUpdated,
        versionChainId: quest.versionChainId,
        name: quest.name,
        description: quest.description,
        projectId: quest.projectId,
        tags: tag,
      })
      .from(quest)
      .leftJoin(questToTags, eq(questToTags.questId, quest.id))
      .leftJoin(tag, eq(tag.id, questToTags.tagId))
      .where(eq(quest.projectId, projectId));

    // Group by quest and combine tags
    const questMap = new Map<string, QuestWithRelations>();
    results.forEach((result) => {
      if (!questMap.has(result.id)) {
        questMap.set(result.id, {
          ...result,
          tags: [],
        });
      }
      if (result.tags) {
        questMap.get(result.id)!.tags.push(result.tags);
      }
    });

    return Array.from(questMap.values());
  }

  async getQuestById(questId: string): Promise<QuestWithRelations | null> {
    const results = await db
      .select({
        id: quest.id,
        rev: quest.rev,
        createdAt: quest.createdAt,
        lastUpdated: quest.lastUpdated,
        versionChainId: quest.versionChainId,
        name: quest.name,
        description: quest.description,
        projectId: quest.projectId,
        tags: tag,
      })
      .from(quest)
      .leftJoin(questToTags, eq(questToTags.questId, quest.id))
      .leftJoin(tag, eq(tag.id, questToTags.tagId))
      .where(eq(quest.id, questId));

    // Group by quest and combine tags
    const questMap = new Map<string, QuestWithRelations>();
    results.forEach((result) => {
      if (!questMap.has(result.id)) {
        questMap.set(result.id, {
          ...result,
          tags: [],
        });
      }
      if (result.tags) {
        questMap.get(result.id)!.tags.push(result.tags);
      }
    });

    return Array.from(questMap.values())[0] || null;
  }
}

export const questService = new QuestService();
