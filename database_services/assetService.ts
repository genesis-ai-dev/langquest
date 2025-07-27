import { eq } from 'drizzle-orm';
import { asset, asset_content_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Asset = typeof asset.$inferSelect;
export type CreateAssetData = Omit<typeof asset.$inferInsert, 'id' | 'created_at' | 'last_updated' | 'active'>;

const { db } = system;

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
    templates: AssetTemplate[],
    creatorId: string
  ): Promise<Asset[]> {
    const createdAssets: Asset[] = [];

    for (const template of templates) {
      const newAsset = await this.createAssetFromTemplate(template, creatorId);
      createdAssets.push(newAsset);
    }

    return createdAssets;
  }
}

export const assetService = new AssetService();
