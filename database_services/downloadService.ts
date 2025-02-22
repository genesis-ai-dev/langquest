import { eq, and } from 'drizzle-orm';
import {
  project_download,
  quest_download,
  asset_download,
  quest,
  quest_asset_link
} from '../db/drizzleSchema';
import { system } from '../db/powersync/system';
import { questService } from './questService';
import { assetService } from './assetService';

const { db } = system;

export class DownloadService {
  async setProjectDownload(
    profileId: string,
    projectId: string,
    active: boolean
  ) {
    try {
      const id = `${profileId}_${projectId}`;
      await db.transaction(async (tx) => {
        // Update/create project download record
        await tx
          .insert(project_download)
          .values({
            id,
            profile_id: profileId,
            project_id: projectId,
            active
          })
          .onConflictDoUpdate({
            target: [project_download.profile_id, project_download.project_id],
            set: { active }
          });

        // Cascade to all quests in the project
        const quests = await questService.getQuestsByProjectId(projectId);
        await Promise.all(
          quests.map((quest) =>
            this.setQuestDownload(profileId, quest.id, active)
          )
        );
      });
    } catch (error) {
      console.error('Error in setProjectDownload:', error);
      throw error;
    }
  }

  async setQuestDownload(profileId: string, questId: string, active: boolean) {
    try {
      const id = `${profileId}_${questId}`;
      await db.transaction(async (tx) => {
        // Update/create quest download record
        await tx
          .insert(quest_download)
          .values({
            id,
            profile_id: profileId,
            quest_id: questId,
            active
          })
          .onConflictDoUpdate({
            target: [quest_download.profile_id, quest_download.quest_id],
            set: { active }
          });

        // Cascade to all assets in the quest
        const assets = await assetService.getAssetsByQuestId(questId);
        await Promise.all(
          assets.map((asset) =>
            this.setAssetDownload(profileId, asset.id, active)
          )
        );
      });
    } catch (error) {
      console.error('Error in setQuestDownload:', error);
      throw error;
    }
  }

  async setAssetDownload(profileId: string, assetId: string, active: boolean) {
    try {
      const id = `${profileId}_${assetId}`;
      const existing = await db
        .select()
        .from(asset_download)
        .where(
          and(
            eq(asset_download.profile_id, profileId),
            eq(asset_download.asset_id, assetId)
          )
        );
      console.log('existing', existing);

      if (existing.length > 0) {
        // Update existing record
        console.log('updating existing record');
        await db
          .update(asset_download)
          .set({ active })
          .where(
            and(
              eq(asset_download.profile_id, profileId),
              eq(asset_download.asset_id, assetId)
            )
          );
      } else {
        console.log('inserting new record');
        // Insert new record
        await db.insert(asset_download).values({
          id,
          profile_id: profileId,
          asset_id: assetId,
          active
        });
      }
    } catch (error) {
      console.error('Error in setAssetDownload:', error);
      throw error;
    }
  }

  // Query methods
  async getProjectDownloadStatus(profileId: string, projectId: string) {
    const result = await db
      .select()
      .from(project_download)
      .where(
        and(
          eq(project_download.profile_id, profileId),
          eq(project_download.project_id, projectId)
        )
      );
    return result[0]?.active ?? false;
  }

  async getQuestDownloadStatus(profileId: string, questId: string) {
    const result = await db
      .select()
      .from(quest_download)
      .where(
        and(
          eq(quest_download.profile_id, profileId),
          eq(quest_download.quest_id, questId)
        )
      );
    return result[0]?.active ?? false;
  }

  async getAssetDownloadStatus(profileId: string, assetId: string) {
    const result = await db
      .select()
      .from(asset_download)
      .where(
        and(
          eq(asset_download.profile_id, profileId),
          eq(asset_download.asset_id, assetId)
        )
      );
    return result[0]?.active ?? false;
  }

  async getAllActiveDownloads(profileId: string) {
    const projects = await db
      .select()
      .from(project_download)
      .where(
        and(
          eq(project_download.profile_id, profileId),
          eq(project_download.active, true)
        )
      );

    const quests = await db
      .select()
      .from(quest_download)
      .where(
        and(
          eq(quest_download.profile_id, profileId),
          eq(quest_download.active, true)
        )
      );

    const assets = await db
      .select()
      .from(asset_download)
      .where(
        and(
          eq(asset_download.profile_id, profileId),
          eq(asset_download.active, true)
        )
      );

    return {
      projects,
      quests,
      assets
    };
  }
}

export const downloadService = new DownloadService();
