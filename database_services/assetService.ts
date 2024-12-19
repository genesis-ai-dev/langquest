import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { asset, tag, asset_tag_link, language, quest_asset_link } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';


const { db } = system;

// export type AssetWithRelations = typeof asset.$inferSelect & {
//   source_language: typeof language.$inferSelect;
//   tags: (typeof tag.$inferSelect)[];
// };

export type Asset = typeof asset.$inferSelect;

export class AssetService {

  async getAssetById(id: string) {
    const results = await db
      .select()
      .from(asset)
      .where(eq(asset.id, id));
    return results[0];
  }

  async getAssetsByQuestId(quest_id: string) {
    // First get asset IDs from junction table
    console.log('Getting asset links for quest:', quest_id);
    const assetLinks = await db
      .select({
        asset_id: quest_asset_link.asset_id
      })
      .from(quest_asset_link)
      .where(eq(quest_asset_link.quest_id, quest_id));
    console.log('Found asset links:', assetLinks);

    // Then get the actual assets
    console.log('Fetching assets for links');
    const assetPromises = assetLinks.map(link => 
      this.getAssetById(link.asset_id)
    );

    const assets = await Promise.all(assetPromises);
    console.log('Fetched assets:', assets);
    return assets;
  }
}

export const assetService = new AssetService();