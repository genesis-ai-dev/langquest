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
    vote_id?: string;
    polarity: Vote['polarity'];
    comment?: string;
    active?: boolean;
  }) {
    try {
      const existingVoteId =
        data.vote_id ??
        (
          await db.query.vote.findFirst({
            where: and(
              eq(vote.translation_id, data.translation_id),
              eq(vote.creator_id, data.creator_id)
            ),
            columns: {
              id: true
            }
          })
        )?.id;

      console.log('existingVoteId', existingVoteId);

      if (existingVoteId) {
        // Update existing vote
        const startTime = Date.now();
        await db
          .update(vote)
          .set({
            polarity: data.polarity,
            comment: data.comment,
            active: data.active ?? true
          })
          .where(eq(vote.id, existingVoteId));
        const endTime = Date.now();
        console.log(
          `Time taken to find existing vote: ${endTime - startTime}ms`
        );
      } else {
        console.log('creating new vote', {
          translation_id: data.translation_id,
          creator_id: data.creator_id,
          polarity: data.polarity,
          comment: data.comment ?? '',
          active: data.active ?? true,
          download_profiles: [data.creator_id]
        });
        // Create new vote - let PowerSync handle array serialization
        await db.insert(vote).values({
          translation_id: data.translation_id,
          creator_id: data.creator_id,
          polarity: data.polarity,
          comment: data.comment ?? '',
          active: data.active ?? true,
          download_profiles: [data.creator_id]
        });
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
