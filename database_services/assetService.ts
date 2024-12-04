import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { asset, tag, assetToTags, language, questToAssets } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';


const { db } = system;

export type AssetWithRelations = typeof asset.$inferSelect & {
  sourceLanguage: typeof language.$inferSelect;
  tags: (typeof tag.$inferSelect)[];
};

export class AssetService {

  async getAssetById(id: string) {
    const sourceLanguage = aliasedTable(language, 'sourceLanguage');
    const [foundAsset] = await db
      .select({
        id: asset.id,
        rev: asset.rev,
        createdAt: asset.createdAt,
        lastUpdated: asset.lastUpdated,
        versionChainId: asset.versionChainId,
        name: asset.name,
        text: asset.text,
        images: asset.images,
        audio: asset.audio,
        sourceLanguageId: asset.sourceLanguageId,
        sourceLanguage: {
          id: sourceLanguage.id,
          rev: sourceLanguage.rev,
          createdAt: sourceLanguage.createdAt,
          lastUpdated: sourceLanguage.lastUpdated,
          versionChainId: sourceLanguage.versionChainId,
          nativeName: sourceLanguage.nativeName,
          englishName: sourceLanguage.englishName,
          iso639_3: sourceLanguage.iso639_3,
          uiReady: sourceLanguage.uiReady,
          creatorId: sourceLanguage.creatorId,
        },
        tags: tag,
      })
      .from(asset)
      .leftJoin(sourceLanguage, eq(asset.sourceLanguageId, sourceLanguage.id)) // Fix: use sourceLanguage alias
      .leftJoin(assetToTags, eq(assetToTags.assetId, asset.id))
      .leftJoin(tag, eq(tag.id, assetToTags.tagId))
      .where(eq(asset.id, id));
    
    // Group tags like in getAssetsByQuestId
    if (!foundAsset || !foundAsset.sourceLanguage) return null;

    const assetWithTags: AssetWithRelations = {
      ...foundAsset,
      sourceLanguage: foundAsset.sourceLanguage,
      tags: foundAsset.tags ? [foundAsset.tags] : [],
    };

    return assetWithTags;
  }

  async getAssetsByQuestId(questId: string): Promise<AssetWithRelations[]> {
    const sourceLanguage = aliasedTable(language, 'sourceLanguage');

    const results = await db
      .select({
        id: asset.id,
        rev: asset.rev,
        createdAt: asset.createdAt,
        lastUpdated: asset.lastUpdated,
        versionChainId: asset.versionChainId,
        name: asset.name,
        text: asset.text,
        images: asset.images,
        audio: asset.audio,
        sourceLanguageId: asset.sourceLanguageId,
        sourceLanguage: {
          id: sourceLanguage.id,
          rev: sourceLanguage.rev,
          createdAt: sourceLanguage.createdAt,
          lastUpdated: sourceLanguage.lastUpdated,
          versionChainId: sourceLanguage.versionChainId,
          nativeName: sourceLanguage.nativeName,
          englishName: sourceLanguage.englishName,
          iso639_3: sourceLanguage.iso639_3,
          uiReady: sourceLanguage.uiReady,
          creatorId: sourceLanguage.creatorId,
        },
        tags: tag,
      })
      .from(asset)
      .innerJoin(questToAssets, eq(questToAssets.assetId, asset.id))
      .innerJoin(sourceLanguage, eq(sourceLanguage.id, asset.sourceLanguageId))
      .leftJoin(assetToTags, eq(assetToTags.assetId, asset.id))
      .leftJoin(tag, eq(tag.id, assetToTags.tagId))
      .where(eq(questToAssets.questId, questId));

    // Group by asset and combine tags
    const assetMap = new Map<string, AssetWithRelations>();
    results.forEach(result => {
      if (!result.sourceLanguage) {
        throw new Error(`Asset ${result.id} has no source language`);
      }

      if (!assetMap.has(result.id)) {
        assetMap.set(result.id, {
          ...result,
          sourceLanguage: result.sourceLanguage,
          tags: result.tags ? [result.tags] : [],
        });
      } else if (result.tags) {
        assetMap.get(result.id)!.tags.push(result.tags);
      }
    });

    return Array.from(assetMap.values());
  }
}

export const assetService = new AssetService();