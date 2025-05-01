import { eq } from 'drizzle-orm';
import {
  asset,
  asset_content_link,
  quest,
  quest_asset_link
} from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Asset = typeof asset.$inferSelect;
export type AssetContent = typeof asset_content_link.$inferSelect;

export class AssetService {
  async getAssetById(id: string) {
    const results = await db.select().from(asset).where(eq(asset.id, id));
    return results[0] as Asset | undefined;
  }

  async getAssetContent(asset_id: string): Promise<AssetContent[]> {
    return db
      .select()
      .from(asset_content_link)
      .where(eq(asset_content_link.asset_id, asset_id));
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
    const assetPromises = assetLinks.map((link) =>
      this.getAssetById(link.asset_id)
    );

    return Promise.all(assetPromises);
  }

  async getAssetsByProjectId(project_id: string) {
    // First get all quests for this project
    const quests = await db
      .select({
        id: quest.id
      })
      .from(quest)
      .where(eq(quest.project_id, project_id));

    // Then get all assets for each quest
    const assetPromises = quests.map((quest) =>
      this.getAssetsByQuestId(quest.id)
    );

    // Wait for all asset queries to complete
    const assetsByQuest = await Promise.all(assetPromises);

    // Flatten the array of arrays and remove duplicates
    const uniqueAssets = new Map<string, Asset>();
    assetsByQuest.flat().forEach((asset) => {
      if (asset) uniqueAssets.set(asset.id, asset);
    });

    return Array.from(uniqueAssets.values());
  }
}

export const assetService = new AssetService();
