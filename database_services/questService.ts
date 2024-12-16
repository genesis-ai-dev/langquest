import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { quest, tag, quest_tag_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type QuestWithRelations = typeof quest.$inferSelect & {
  tags: (typeof tag.$inferSelect)[];
};

export class QuestService {
  async getQuestsByProject_id(project_id: string): Promise<QuestWithRelations[]> {
    const results = await db
      .select({
        id: quest.id,
        rev: quest.rev,
        created_at: quest.created_at,
        last_updated: quest.last_updated,
        version_chain_id: quest.version_chain_id,
        name: quest.name,
        description: quest.description,
        project_id: quest.project_id,
        tags: tag,
      })
      .from(quest)
      .leftJoin(quest_tag_link, eq(quest_tag_link.quest_id, quest.id))
      .leftJoin(tag, eq(tag.id, quest_tag_link.tag_id))
      .where(eq(quest.project_id, project_id));

    // Group by quest and combine tags
    const questMap = new Map<string, QuestWithRelations>();
    results.forEach(result => {
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
}

export const questService = new QuestService();