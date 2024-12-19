import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { quest, tag, quest_tag_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

export type Quest = typeof quest.$inferSelect;

export class QuestService {
  async getQuestsByProjectId(project_id: string): Promise<Quest[]> {
    return db
      .select()
      .from(quest)
      .where(eq(quest.project_id, project_id));
  }
}

export const questService = new QuestService();