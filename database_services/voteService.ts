import { eq, and } from 'drizzle-orm';
// import { db } from '../db/database';
import { vote } from '../db/drizzleSchema';
import { randomUUID } from 'expo-crypto';
import { system } from '../db/powersync/system';

export type Vote = typeof vote.$inferSelect;

const { db } = system;

export class VoteService {
  async addVote(data: {
    translation_id: string;
    creator_id: string;
    polarity: 'up' | 'down';
    comment?: string;
  }) {
    try {
      const existingVote = await db
        .select()
        .from(vote)
        .where(
          and(
            eq(vote.translation_id, data.translation_id),
            eq(vote.creator_id, data.creator_id)
          )
        )
        .get();

      if (existingVote) {
        if (existingVote.polarity === data.polarity) {
          // Remove vote if clicking same button again
          await db.delete(vote).where(eq(vote.id, existingVote.id));
          return null;
        } else {
          // Update vote if changing polarity
          const [updatedVote] = await db
            .update(vote)
            .set({
              polarity: data.polarity,
              comment: data.comment
              // last_updated: new Date(),
            })
            .where(eq(vote.id, existingVote.id))
            .returning();
          return updatedVote;
        }
      }

      // Create new vote
      const [newVote] = await db
        .insert(vote)
        .values({
          translation_id: data.translation_id,
          creator_id: data.creator_id,
          polarity: data.polarity,
          comment: data.comment || ''
        })
        .returning();

      console.log('New vote created:', newVote); // Add logging
      return newVote;
    } catch (error) {
      console.error('Error in addVote:', error);
      throw error;
    }
  }

  async getUserVoteForTranslation(
    translation_id: string,
    userId: string
  ): Promise<typeof vote.$inferSelect | null> {
    const result = await db
      .select()
      .from(vote)
      .where(
        and(
          eq(vote.translation_id, translation_id),
          eq(vote.creator_id, userId)
        )
      )
      .get();

    return result || null;
  }

  async getVotesByTranslationId(translation_id: string): Promise<Vote[]> {
    return db
      .select()
      .from(vote)
      .where(eq(vote.translation_id, translation_id));
  }
}

export const voteService = new VoteService();
