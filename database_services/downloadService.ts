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

interface PlannedUpdate {
  table:
    | typeof project_download
    | typeof quest_download
    | typeof asset_download;
  id: string;
  values: {
    id: string;
    profile_id: string;
    project_id?: string;
    quest_id?: string;
    asset_id?: string;
    active: boolean;
  };
}

export class DownloadService {
  private plannedUpdates: PlannedUpdate[] = [];
  private isInProjectUpdate = false;
  private isInQuestUpdate = false;

  private async canPerformUpdates(): Promise<boolean> {
    // TODO: Implement your actual check here
    return true;
  }

  private async executePlannedUpdates() {
    if (!(await this.canPerformUpdates())) {
      throw new Error('Cannot perform updates at this time');
    }

    await db.transaction(async (tx) => {
      for (const update of this.plannedUpdates) {
        const existing = await tx
          .select()
          .from(update.table)
          .where(eq(update.table.id, update.values.id));

        if (existing.length > 0) {
          await tx
            .update(update.table)
            .set({ active: update.values.active })
            .where(eq(update.table.id, update.values.id));
        } else {
          await tx.insert(update.table).values(update.values);
        }
      }
    });

    this.plannedUpdates = [];
  }

  private addPlannedUpdate(update: PlannedUpdate) {
    this.plannedUpdates.push(update);
  }

  async setProjectDownload(
    profileId: string,
    projectId: string,
    active: boolean
  ) {
    try {
      this.isInProjectUpdate = true;
      const id = `${profileId}_${projectId}`;

      this.addPlannedUpdate({
        table: project_download,
        id,
        values: {
          id,
          profile_id: profileId,
          project_id: projectId,
          active
        }
      });

      // Cascade to all quests in the project
      const quests = await questService.getQuestsByProjectId(projectId);
      for (const quest of quests) {
        await this.setQuestDownload(profileId, quest.id, active);
      }

      await this.executePlannedUpdates();
      this.isInProjectUpdate = false;
    } catch (error) {
      this.isInProjectUpdate = false;
      console.error('Error in setProjectDownload:', error);
      throw error;
    }
  }

  async setQuestDownload(profileId: string, questId: string, active: boolean) {
    try {
      this.isInQuestUpdate = true;
      const id = `${profileId}_${questId}`;

      this.addPlannedUpdate({
        table: quest_download,
        id,
        values: {
          id,
          profile_id: profileId,
          quest_id: questId,
          active
        }
      });

      // Cascade to all assets in the quest
      const assets = await assetService.getAssetsByQuestId(questId);
      for (const asset of assets) {
        await this.setAssetDownload(profileId, asset.id, active);
      }

      // If this is a direct call (not part of project update), execute immediately
      if (!this.isInProjectUpdate) {
        await this.executePlannedUpdates();
      }
      this.isInQuestUpdate = false;
    } catch (error) {
      this.isInQuestUpdate = false;
      console.error('Error in setQuestDownload:', error);
      throw error;
    }
  }

  async setAssetDownload(profileId: string, assetId: string, active: boolean) {
    try {
      const id = `${profileId}_${assetId}`;

      this.addPlannedUpdate({
        table: asset_download,
        id,
        values: {
          id,
          profile_id: profileId,
          asset_id: assetId,
          active
        }
      });

      // If this is a direct call (not part of project or quest update), execute immediately
      if (!this.isInProjectUpdate && !this.isInQuestUpdate) {
        await this.executePlannedUpdates();
      }
    } catch (error) {
      console.error('Error in setAssetDownload:', error);
      throw error;
    }
  }

  // Query methods
  async getProjectDownloadStatus(profileId: string, projectId: string) {
    try {
      const result = await db
        .select()
        .from(project_download)
        .where(
          and(
            eq(project_download.profile_id, profileId),
            eq(project_download.project_id, projectId)
          )
        );

      console.log('Project download status result:', result);
      return result[0]?.active ?? false;
    } catch (error) {
      console.error('Error getting project download status:', error);
      return false;
    }
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
