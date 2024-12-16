import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { translation, vote, language, user } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { system,  } from '../db/powersync/system';

const { db } = system;

export type TranslationWithRelations = typeof translation.$inferSelect & {
  target_language: typeof language.$inferSelect;
  creator: typeof user.$inferSelect;
  votes: (typeof vote.$inferSelect)[];
  voteCount: number;
};

export class TranslationService {
  async getTranslationsByAsset_id(asset_id: string): Promise<TranslationWithRelations[]> {
    const target_language = aliasedTable(language, 'target_language');
    const creator = aliasedTable(user, 'creator');

    const results = await db
      .select({
        // Translation fields
        id: translation.id,
        rev: translation.rev,
        created_at: translation.created_at,
        last_updated: translation.last_updated,
        version_chain_id: translation.version_chain_id,
        text: translation.text,
        audio: translation.audio,
        asset_id: translation.asset_id,
        target_language_id: translation.target_language_id,
        creator_id: translation.creator_id,
        // Related fields
        target_language: {
            id: target_language.id,
            rev: target_language.rev,
            created_at: target_language.created_at,
            last_updated: target_language.last_updated,
            version_chain_id: target_language.version_chain_id,
            native_name: target_language.native_name,
            english_name: target_language.english_name,
            iso639_3: target_language.iso639_3,
            ui_ready: target_language.ui_ready,
            creator_id: target_language.creator_id,
        },
        creator: {
          id: creator.id,
          rev: creator.rev,
          created_at: creator.created_at,
          last_updated: creator.last_updated,
          version_chain_id: creator.version_chain_id,
          username: creator.username,
          password: creator.password,
          ui_language_id: creator.ui_language_id,
        },
        votes: vote,
      })
      .from(translation)
      .innerJoin(target_language, eq(target_language.id, translation.target_language_id))
      .innerJoin(creator, eq(creator.id, translation.creator_id))
      .leftJoin(vote, eq(vote.translation_id, translation.id))
      .where(eq(translation.asset_id, asset_id));

    // Group by translation and combine votes
    const translationMap = new Map<string, TranslationWithRelations>();
    results.forEach(result => {
      if (!translationMap.has(result.id)) {
        const translationWithRelations: TranslationWithRelations = {
          id: result.id,
          rev: result.rev,
          created_at: result.created_at,
          last_updated: result.last_updated,
          version_chain_id: result.version_chain_id,
          text: result.text,
          audio: result.audio,
          asset_id: result.asset_id,
          target_language_id: result.target_language_id,
          creator_id: result.creator_id,
          target_language: result.target_language,
          creator: result.creator,
          votes: result.votes ? [result.votes] : [],
          voteCount: 0
        };
        translationMap.set(result.id, translationWithRelations);
      } else if (result.votes) {
        translationMap.get(result.id)!.votes.push(result.votes);
      }
    });

    // Calculate vote counts
    translationMap.forEach(translation => {
      translation.voteCount = translation.votes.reduce((count, vote) => 
        count + (vote.polarity === 'up' ? 1 : -1), 0);
    });

    return Array.from(translationMap.values());
  }

  async createTranslation(data: {
    text: string;
    target_language_id: string;
    asset_id: string;
    creator_id: string;
    // audio?: string[];
  }) {
    const [newTranslation] = await db
      .insert(translation)
      .values({
        rev: 1,
        text: data.text,
        audio: [], // Empty array for now
        asset_id: data.asset_id,
        target_language_id: data.target_language_id,
        creator_id: data.creator_id,
        version_chain_id: randomUUID(),
      })
      .returning();
    
    return newTranslation;
  }

}

export const translationService = new TranslationService();