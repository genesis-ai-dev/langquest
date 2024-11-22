import { eq, and } from 'drizzle-orm';
import { db } from '../db/database';
import { vote } from '../db/drizzleSchema';
import { randomUUID } from 'expo-crypto';

export class VoteService {
  async addVote(data: {
    translationId: string;
    creatorId: string;
    polarity: 'up' | 'down';
    comment?: string;
  }) {
    const existingVote = await db
      .select()
      .from(vote)
      .where(
        and(
          eq(vote.translationId, data.translationId),
          eq(vote.creatorId, data.creatorId)
        )
      )
      .get();

    if (existingVote) {
      if (existingVote.polarity === data.polarity) {
        // Remove vote if clicking same button
        await db.delete(vote).where(eq(vote.id, existingVote.id));
        return null;
      } else {
        // Update vote if changing polarity
        const [updatedVote] = await db
          .update(vote)
          .set({
            polarity: data.polarity,
            comment: data.comment,
            // lastUpdated: new Date(),
          })
          .where(eq(vote.id, existingVote.id))
          .returning();
        return updatedVote;
      }
    } else {
      // Create new vote
      const [newVote] = await db
        .insert(vote)
        .values({
          rev: 1,
          translationId: data.translationId,
          creatorId: data.creatorId,
          polarity: data.polarity,
          comment: data.comment,
          versionChainId: randomUUID(),
        })
        .returning();
      return newVote;
    }
  }
}

export const voteService = new VoteService();