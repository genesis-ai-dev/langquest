import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { translation, vote, language, user } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

export type TranslationWithRelations = typeof translation.$inferSelect & {
  targetLanguage: typeof language.$inferSelect;
  creator: typeof user.$inferSelect;
  votes: (typeof vote.$inferSelect)[];
  voteCount: number;
};

export class TranslationService {
  async getTranslationsByAssetId(assetId: string): Promise<TranslationWithRelations[]> {
    const targetLanguage = aliasedTable(language, 'targetLanguage');
    const creator = aliasedTable(user, 'creator');

    const results = await db
      .select({
        // Translation fields
        id: translation.id,
        rev: translation.rev,
        createdAt: translation.createdAt,
        lastUpdated: translation.lastUpdated,
        versionChainId: translation.versionChainId,
        text: translation.text,
        audio: translation.audio,
        assetId: translation.assetId,
        targetLanguageId: translation.targetLanguageId,
        creatorId: translation.creatorId,
        // Related fields
        targetLanguage: {
            id: targetLanguage.id,
            rev: targetLanguage.rev,
            createdAt: targetLanguage.createdAt,
            lastUpdated: targetLanguage.lastUpdated,
            versionChainId: targetLanguage.versionChainId,
            nativeName: targetLanguage.nativeName,
            englishName: targetLanguage.englishName,
            iso639_3: targetLanguage.iso639_3,
            uiReady: targetLanguage.uiReady,
            creatorId: targetLanguage.creatorId,
        },
        creator: {
          id: creator.id,
          rev: creator.rev,
          createdAt: creator.createdAt,
          lastUpdated: creator.lastUpdated,
          versionChainId: creator.versionChainId,
          username: creator.username,
          password: creator.password,
          uiLanguageId: creator.uiLanguageId,
        },
        votes: vote,
      })
      .from(translation)
      .innerJoin(targetLanguage, eq(targetLanguage.id, translation.targetLanguageId))
      .innerJoin(creator, eq(creator.id, translation.creatorId))
      .leftJoin(vote, eq(vote.translationId, translation.id))
      .where(eq(translation.assetId, assetId));

    // Group by translation and combine votes
    const translationMap = new Map<string, TranslationWithRelations>();
    results.forEach(result => {
      if (!translationMap.has(result.id)) {
        const translationWithRelations: TranslationWithRelations = {
          id: result.id,
          rev: result.rev,
          createdAt: result.createdAt,
          lastUpdated: result.lastUpdated,
          versionChainId: result.versionChainId,
          text: result.text,
          audio: result.audio,
          assetId: result.assetId,
          targetLanguageId: result.targetLanguageId,
          creatorId: result.creatorId,
          targetLanguage: result.targetLanguage,
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
    targetLanguageId: string;
    assetId: string;
    creatorId: string;
    // audio?: string[];
  }) {
    const [newTranslation] = await db
      .insert(translation)
      .values({
        rev: 1,
        text: data.text,
        audio: [], // Empty array for now
        assetId: data.assetId,
        targetLanguageId: data.targetLanguageId,
        creatorId: data.creatorId,
        versionChainId: randomUUID(),
      })
      .returning();
    
    return newTranslation;
  }

}

export const translationService = new TranslationService();