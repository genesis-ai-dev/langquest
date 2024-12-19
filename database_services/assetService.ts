import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { asset, tag, asset_tag_link, language, quest_asset_link } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';


const { db } = system;

export type AssetWithRelations = typeof asset.$inferSelect & {
  source_language: typeof language.$inferSelect;
  tags: (typeof tag.$inferSelect)[];
};

export class AssetService {

  async getAssetById(id: string) {
    const source_language = aliasedTable(language, 'source_language');
    const [foundAsset] = await db
      .select({
        id: asset.id,
        rev: asset.rev,
        created_at: asset.created_at,
        last_updated: asset.last_updated,
        version_chain_id: asset.version_chain_id,
        name: asset.name,
        text: asset.text,
        images: asset.images,
        audio: asset.audio,
        source_language_id: asset.source_language_id,
        source_language: {
          id: source_language.id,
          rev: source_language.rev,
          created_at: source_language.created_at,
          last_updated: source_language.last_updated,
          version_chain_id: source_language.version_chain_id,
          native_name: source_language.native_name,
          english_name: source_language.english_name,
          iso639_3: source_language.iso639_3,
          ui_ready: source_language.ui_ready,
          creator_id: source_language.creator_id,
        },
        tags: tag,
      })
      .from(asset)
      .leftJoin(source_language, eq(asset.source_language_id, source_language.id)) // Fix: use source_language alias
      .leftJoin(asset_tag_link, eq(asset_tag_link.asset_id, asset.id))
      .leftJoin(tag, eq(tag.id, asset_tag_link.tag_id))
      .where(eq(asset.id, id));
    
    // Group tags like in getAssetsByQuest_id
    if (!foundAsset || !foundAsset.source_language) return null;

    const assetWithTags: AssetWithRelations = {
      ...foundAsset,
      source_language: foundAsset.source_language,
      tags: foundAsset.tags ? [foundAsset.tags] : [],
    };

    return assetWithTags;
  }

  async getAssetsByQuestId(quest_id: string) {
    // First get asset IDs from junction table
    const assetLinks = await db
      .select({
        asset_id: quest_asset_link.asset_id
      })
      .from(quest_asset_link)
      .where(eq(quest_asset_link.quest_id, quest_id));

    // Then get the actual assets
    const assetPromises = assetLinks.map(link => 
      this.getAssetById(link.asset_id)
    );

    return Promise.all(assetPromises);
  }
}

export const assetService = new AssetService();