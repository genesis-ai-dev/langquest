import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { quest } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

// export type QuestWithRelations = typeof quest.$inferSelect & {
//   tags: (typeof tag.$inferSelect)[];
// };

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
