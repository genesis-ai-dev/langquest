import { resolveTable } from '@/utils/dbUtils';
import { and, eq } from 'drizzle-orm';
import { blocked_content, blocked_users } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type BlockedUser = typeof blocked_users.$inferSelect;
export type BlockedContent = typeof blocked_content.$inferSelect;

const { db } = system;

export type BlockedUserInsert = Omit<typeof blocked_users.$inferInsert, 'id'>;

export class BlockService {
  async blockUser(data: BlockedUserInsert) {
    // Check if already blocked to avoid duplicates
    const existingBlock = await db.query.blocked_users.findFirst({
      where: and(
        eq(blocked_users.blocker_id, data.blocker_id),
        eq(blocked_users.blocked_id, data.blocked_id)
      )
    });

    if (existingBlock) {
      return existingBlock;
    }

    // With composite primary key, returning the inserted record directly
    await db.insert(resolveTable('blocked_users')).values({
      ...data,
      id: `${data.blocker_id}_${data.blocked_id}`
    });

    return data;
  }

  async blockContent(data: typeof blocked_content.$inferInsert) {
    // Check if already blocked to avoid duplicates
    const existingBlock = await db.query.blocked_content.findFirst({
      where: and(
        eq(blocked_content.profile_id, data.profile_id),
        eq(blocked_content.content_id, data.content_id),
        eq(blocked_content.content_table, data.content_table)
      )
    });

    if (existingBlock) {
      return existingBlock;
    }

    // Insert the data and return with generated ID

    await db.insert(resolveTable('blocked_content')).values(data);

    return data;
  }

  async getUserBlockedUsers(profileId: string) {
    return db.query.blocked_users.findMany({
      where: eq(blocked_users.blocker_id, profileId)
    });
  }

  async getUserBlockedContent(profileId: string) {
    return db.query.blocked_content.findMany({
      where: eq(blocked_content.profile_id, profileId)
    });
  }
}

export const blockService = new BlockService();
