import { and, eq } from 'drizzle-orm';
import { blocked_content, blocked_users } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type BlockedUser = typeof blocked_users.$inferSelect;
export type BlockedContent = typeof blocked_content.$inferSelect;

const { db } = system;

export class BlockService {
  async blockUser(data: typeof blocked_users.$inferInsert) {
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
    await db.insert(blocked_users).values(data);

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

    await db.insert(blocked_content).values(data);

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

  async unblockUser(blockerId: string, blockedId: string) {
    await db
      .delete(blocked_users)
      .where(
        and(
          eq(blocked_users.blocker_id, blockerId),
          eq(blocked_users.blocked_id, blockedId)
        )
      );

    return { blocker_id: blockerId, blocked_id: blockedId };
  }

  async unblockContent(
    profileId: string,
    contentId: string,
    contentTable: string
  ) {
    await db
      .delete(blocked_content)
      .where(
        and(
          eq(blocked_content.profile_id, profileId),
          eq(blocked_content.content_id, contentId),
          eq(blocked_content.content_table, contentTable)
        )
      );

    return {
      profile_id: profileId,
      content_id: contentId,
      content_table: contentTable
    };
  }
}

export const blockService = new BlockService();
