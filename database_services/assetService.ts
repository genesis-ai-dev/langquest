import { eq } from 'drizzle-orm';
import { asset, quest_asset_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Asset = typeof asset.$inferSelect;

export class AssetService {
  async getAssetById(id: string) {
    const results = await db.select().from(asset).where(eq(asset.id, id));
    return results[0];
  }

  async getAssetsByQuestId(quest_id: string) {
    // First get asset IDs from junction table
    const assetLinks = await db
      .select({
        asset_id: quest_asset_link.asset_id,
      })
      .from(quest_asset_link)
      .where(eq(quest_asset_link.quest_id, quest_id));

    // Then get the actual assets
    const assetPromises = assetLinks.map((link) =>
      this.getAssetById(link.asset_id),
    );

    return Promise.all(assetPromises);
  }
}

export const assetService = new AssetService();
