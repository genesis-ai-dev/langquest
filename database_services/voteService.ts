import { and, eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { resolveTable } from '@/utils/dbUtils';
import { vote } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Vote = typeof vote.$inferSelect;

const { db } = system;

export class VoteService {
  async addVote(data: {
    asset_id: string;
    creator_id: string;
    vote_id?: string;
    polarity: Vote['polarity'];
    comment?: string;
    active?: boolean;
  }) {
    const voteTable = resolveTable('vote');
    try {
      const existingVoteId =
        data.vote_id ??
        (
          await db.query.vote.findFirst({
            where: and(
              eq(vote.asset_id, data.asset_id),
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
          .update(voteTable)
          .set({
            polarity: data.polarity,
            comment: data.comment,
            active: data.active ?? true
          })
          .where(eq(voteTable.id, existingVoteId));
        const endTime = Date.now();
        console.log(
          `Time taken to find existing vote: ${endTime - startTime}ms`
        );
      } else {
        console.log('creating new vote', {
          asset_id: data.asset_id,
          creator_id: data.creator_id,
          polarity: data.polarity,
          comment: data.comment ?? '',
          active: data.active ?? true,
          download_profiles: [data.creator_id]
        });
        // Create new vote - let PowerSync handle array serialization
        // Note: download_profiles will be auto-populated by the database trigger
        await db.insert(voteTable).values({
          asset_id: data.asset_id,
          creator_id: data.creator_id,
          polarity: data.polarity,
          comment: data.comment ?? '',
          active: data.active ?? true,
          download_profiles: [data.creator_id]
          // download_profiles will be populated by the database trigger from the asset
        });
      }
    } catch (error) {
      console.error('Error in addVote:', error);
      throw error;
    }
  }

  async getUserVoteForTranslation(asset_id: string, userId: string) {
    const result = await db.query.vote.findFirst({
      where: and(
        eq(vote.asset_id, asset_id),
        eq(vote.creator_id, userId),
        eq(vote.active, true)
      )
    });
    return result;
  }

  async getVotesByAssetId(asset_id: string) {
    const result = await db.query.vote.findMany({
      where: and(eq(vote.asset_id, asset_id), eq(vote.active, true))
    });
    return result;
  }
}

export const voteService = new VoteService();
