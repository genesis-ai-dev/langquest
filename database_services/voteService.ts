import { and, eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { vote } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Vote = typeof vote.$inferSelect;

const { db } = system;

export class VoteService {
  async addVote(data: {
    translation_id: string;
    creator_id: string;
    polarity: Vote['polarity'];
    comment?: string;
  }) {
    try {
      const existingVotes = await db.query.vote.findMany({
        where: and(
          eq(vote.translation_id, data.translation_id),
          eq(vote.creator_id, data.creator_id)
        )
      });

      const existingVote = existingVotes.find(
        (vote) => vote.polarity === data.polarity
      );

      // Deactivate all existing user votes for this translation
      await Promise.all(
        existingVotes
          .filter((v) => v.active && v.id !== existingVote?.id)
          .map((v) =>
            db.update(vote).set({ active: false }).where(eq(vote.id, v.id))
          )
      );

      if (existingVote) {
        console.log('Existing vote found:', existingVote);
        const updatedVote = await db
          .update(vote)
          .set({
            active: !existingVote.active,
            comment: data.comment
          })
          .where(eq(vote.id, existingVote.id))
          .returning();
        return updatedVote;
      } else {
        // Create new vote
        const [newVote] = await db
          .insert(vote)
          .values({
            translation_id: data.translation_id,
            creator_id: data.creator_id,
            polarity: data.polarity,
            comment: data.comment ?? ''
          })
          .returning();

        console.log('New vote created:', newVote); // Add logging
        return newVote;
      }
    } catch (error) {
      console.error('Error in addVote:', error);
      throw error;
    }
  }

  async getUserVoteForTranslation(translation_id: string, userId: string) {
    const result = await db.query.vote.findFirst({
      where: and(
        eq(vote.translation_id, translation_id),
        eq(vote.creator_id, userId),
        eq(vote.active, true)
      )
    });
    return result;
  }

  async getVotesByTranslationId(translation_id: string) {
    const result = await db.query.vote.findMany({
      where: and(eq(vote.translation_id, translation_id), eq(vote.active, true))
    });
    return result;
  }
}

export const voteService = new VoteService();
