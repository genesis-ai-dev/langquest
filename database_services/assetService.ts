import { eq } from 'drizzle-orm';
import { asset, quest_asset_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

const { db } = system;

export type Asset = typeof asset.$inferSelect;

export class AssetService {
  async getAssetById(id: string) {
    return (
      (await db.query.asset.findFirst({
        where: eq(asset.id, id)
      })) ?? null
    );
  }

  async getAssetsByQuestId(quest_id: string) {
    const assetLinks = await db.query.quest_asset_link.findMany({
      where: eq(quest_asset_link.quest_id, quest_id),
      with: {
        asset: true
      }
    });

    return assetLinks.map((link) => link.asset);
  }
}

export const assetService = new AssetService();
