import { eq } from 'drizzle-orm';
import { asset, asset_content_link, quest_asset_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Asset = typeof asset.$inferSelect;
export type CreateAssetData = Omit<typeof asset.$inferInsert, 'id' | 'created_at' | 'last_updated' | 'active'>;

const { db } = system;

// Note: quest_asset_link IDs use PowerSync composite format: quest_id_asset_id

export interface AssetTemplate {
  name: string;
  source_language_id: string;
  text_content?: string;
  images?: string[];
  visible?: boolean;
}

export class AssetService {
  async getAllAssets(): Promise<Asset[]> {
    console.log('getAllAssets trying to fetch assets');
    const results = await db.select().from(asset);
    console.log('getAllAssets fetched assets', results);
    return results;
  }

  async getAssetById(id: string) {
    const [result] = await db.select().from(asset).where(eq(asset.id, id));
    return result;
  }

  async createAsset(assetData: CreateAssetData): Promise<Asset> {
    console.log('createAsset attempting to create asset:', assetData);

    // Insert the asset
    const [newAsset] = await db.insert(asset).values({
      ...assetData,
      download_profiles: assetData.creator_id ? [assetData.creator_id] : []
    }).returning();

    if (!newAsset) {
      throw new Error('Failed to create asset');
    }

    console.log('createAsset successfully created asset:', newAsset);
    return newAsset;
  }

  async createAssetFromTemplate(
    template: AssetTemplate,
    creatorId: string
  ): Promise<Asset> {
    const assetData: CreateAssetData = {
      name: template.name,
      source_language_id: template.source_language_id,
      images: template.images || null,
      creator_id: creatorId,
      visible: template.visible ?? true
    };

    const newAsset = await this.createAsset(assetData);

    // Create content link if text content is provided
    if (template.text_content) {
      await this.createAssetContent(newAsset.id, template.text_content, creatorId);
    }

    return newAsset;
  }

  async createAssetContent(
    asset_id: string,
    text: string,
    creatorId: string
  ): Promise<void> {
    await db.insert(asset_content_link).values({
      asset_id,
      text,
      download_profiles: [creatorId]
    });
  }

  async createMultipleAssetsFromTemplates(
    assetTemplates: AssetTemplate[],
    creatorId: string
  ): Promise<Asset[]> {
    const createdAssets: Asset[] = [];

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < assetTemplates.length; i += BATCH_SIZE) {
      const batch = assetTemplates.slice(i, i + BATCH_SIZE);

      for (const template of batch) {
        const asset = await this.createAssetFromTemplate(template, creatorId);
        createdAssets.push(asset);
      }
    }

    return createdAssets;
  }

  // Bulk insert methods for better performance
  async createAssetsBulk(assetsData: CreateAssetData[]): Promise<Asset[]> {
    if (assetsData.length === 0) return [];

    console.log(`createAssetsBulk inserting ${assetsData.length} assets`);

    // Prepare data with download_profiles
    const assetsWithProfiles = assetsData.map(assetData => ({
      ...assetData,
      download_profiles: assetData.creator_id ? [assetData.creator_id] : []
    }));

    // Process in batches to avoid stack overflow with large datasets
    const BATCH_SIZE = 1000;
    const createdAssets: Asset[] = [];

    for (let i = 0; i < assetsWithProfiles.length; i += BATCH_SIZE) {
      const batch = assetsWithProfiles.slice(i, i + BATCH_SIZE);
      console.log(`Processing asset batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(assetsWithProfiles.length / BATCH_SIZE)}: ${batch.length} assets`);

      const batchResult = await system.db.insert(asset).values(batch).returning();
      createdAssets.push(...batchResult);
    }

    console.log(`createAssetsBulk successfully created ${createdAssets.length} assets`);
    return createdAssets;
  }

  async createAssetContentBulk(contentData: { asset_id: string; text: string; creatorId: string }[]): Promise<void> {
    if (contentData.length === 0) return;

    console.log(`createAssetContentBulk inserting ${contentData.length} asset contents`);

    const contentWithProfiles = contentData.map(({ asset_id, text, creatorId }) => ({
      asset_id,
      text,
      download_profiles: [creatorId]
    }));

    // Process in batches to avoid stack overflow with large datasets
    const BATCH_SIZE = 1000;

    for (let i = 0; i < contentWithProfiles.length; i += BATCH_SIZE) {
      const batch = contentWithProfiles.slice(i, i + BATCH_SIZE);
      console.log(`Processing content batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contentWithProfiles.length / BATCH_SIZE)}: ${batch.length} contents`);

      await system.db.insert(asset_content_link).values(batch);
    }

    console.log(`createAssetContentBulk successfully created ${contentData.length} asset contents`);
  }

  async createQuestAssetLinksBulk(linkData: { quest_id: string; asset_id: string; creatorId: string }[]): Promise<void> {
    if (linkData.length === 0) return;

    console.log(`createQuestAssetLinksBulk inserting ${linkData.length} quest-asset links`);

    const linksWithProfiles = linkData.map(({ quest_id, asset_id, creatorId }) => ({
      id: `${quest_id}_${asset_id}`, // PowerSync composite key format
      quest_id,
      asset_id,
      download_profiles: [creatorId],
      visible: true
    }));

    // Process in batches to avoid stack overflow with large datasets
    const BATCH_SIZE = 1000;

    for (let i = 0; i < linksWithProfiles.length; i += BATCH_SIZE) {
      const batch = linksWithProfiles.slice(i, i + BATCH_SIZE);
      console.log(`Processing link batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(linksWithProfiles.length / BATCH_SIZE)}: ${batch.length} links`);

      await system.db.insert(quest_asset_link).values(batch);
    }

    console.log(`createQuestAssetLinksBulk successfully created ${linkData.length} quest-asset links`);
  }
}

export const assetService = new AssetService();
