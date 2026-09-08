import { asset, asset_content_link, project, quest, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { promoteLocalAudio } from '@/services/attachments/promoteLocalAudio';
import { isLocalOnlyAudio } from '@/utils/attachmentPaths';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { aliasedColumn } from './dbUtils';
import { getLocalAttachmentUri } from './fileUtils';

// ============================================================================
// TYPES
// ============================================================================

export interface PublishQuestResult {
  success: boolean;
  status: 'queued' | 'error';
  message: string;
  publishedQuestIds?: string[];
  publishedAssetIds?: string[];
  publishedProjectId?: string;
  pendingAttachments?: number;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// RECURSIVE CTE HELPERS
// ============================================================================

async function getParentQuests(questId: string) {
  const parentQuests = system.db
    .select({
      id: quest.id,
      parent_id: quest.parent_id,
      depth: sql`0`.as('depth')
    })
    .from(quest)
    .where(and(eq(quest.id, questId), isNotNull(quest.parent_id)));

  const alias = 'parent_quests';
  const parentQuestsAlias = parentQuests.as(alias);
  const recursiveQueryName = sql.raw(`"${alias}"`);

  const recursiveQuery = parentQuests.unionAll(
    system.db
      .select({
        id: quest.id,
        parent_id: quest.parent_id,
        depth: sql`${parentQuestsAlias.depth} + 1`
      })
      .from(quest)
      .innerJoin(recursiveQueryName, eq(quest.id, parentQuestsAlias.parent_id))
  );

  const query = sql`WITH RECURSIVE ${recursiveQueryName} AS ${recursiveQuery}
    SELECT * FROM ${recursiveQueryName}
    ORDER BY ${parentQuestsAlias.depth}, ${parentQuestsAlias.id}`;

  const allQuests = await system.db
    .run(query)
    .then(
      (result) =>
        result.rows?._array as Awaited<
          ReturnType<(typeof recursiveQuery)['execute']>
        >
    );

  return allQuests;
}

async function getNestedQuests(questId: string) {
  const nestedQuests = system.db
    .select({
      id: quest.id,
      parent_id: quest.parent_id,
      depth: sql`0`.as('depth')
    })
    .from(quest)
    .where(and(eq(quest.id, questId)));

  const alias = 'nested_quests';
  const nestedQuestsAlias = nestedQuests.as(alias);
  const recursiveQueryName = sql.raw(`"${alias}"`);

  const recursiveQuery = nestedQuests.unionAll(
    system.db
      .select({
        id: quest.id,
        parent_id: quest.parent_id,
        depth: sql`${nestedQuestsAlias.depth} + 1`
      })
      .from(quest)
      .innerJoin(recursiveQueryName, eq(quest.parent_id, nestedQuestsAlias.id))
  );

  const query = sql`WITH RECURSIVE ${recursiveQueryName} AS ${recursiveQuery}
    SELECT * FROM ${recursiveQueryName}
    ORDER BY ${nestedQuestsAlias.depth}, ${nestedQuestsAlias.id}`;

  const allQuests = await system.db
    .run(query)
    .then(
      (result) =>
        result.rows?._array as Awaited<
          ReturnType<(typeof recursiveQuery)['execute']>
        >
    );

  return allQuests;
}

async function getNestedAssets(questIds: string[]) {
  const nestedAssets = system.db
    .select({
      asset_id: aliasedColumn(asset.id, 'asset_id'),
      quest_id: aliasedColumn(quest_asset_link.quest_id, 'quest_id'),
      source_asset_id: aliasedColumn(asset.source_asset_id, 'source_asset_id'),
      depth: sql<number>`0`.as('depth')
    })
    .from(asset)
    .where(inArray(quest_asset_link.quest_id, questIds))
    .innerJoin(quest_asset_link, eq(quest_asset_link.asset_id, asset.id));

  const alias = 'nested_assets';
  const nestedAssetsAlias = nestedAssets.as(alias);
  const recursiveQueryName = sql.raw(`"${alias}"`);

  const recursiveQuery = nestedAssets.unionAll(
    system.db
      .select({
        asset_id: aliasedColumn(asset.id, 'asset_id'),
        quest_id: aliasedColumn(quest_asset_link.quest_id, 'quest_id'),
        source_asset_id: aliasedColumn(
          asset.source_asset_id,
          'source_asset_id'
        ),
        depth: sql<number>`${nestedAssetsAlias.depth} + 1`
      })
      .from(asset)
      .innerJoin(quest_asset_link, eq(quest_asset_link.asset_id, asset.id))
      .innerJoin(
        recursiveQueryName,
        eq(asset.source_asset_id, sql`nested_assets.asset_id`)
      )
  );

  const query = sql`WITH RECURSIVE ${recursiveQueryName} AS ${recursiveQuery}
    SELECT * FROM ${recursiveQueryName}
    ORDER BY ${nestedAssetsAlias.depth}, ${nestedAssetsAlias.quest_id}`;

  const allAssets = await system.db
    .run(query)
    .then(
      (result) =>
        result.rows?._array as unknown as Awaited<
          ReturnType<(typeof recursiveQuery)['execute']>
        >
    );

  return allAssets;
}

// ============================================================================
// MAIN PUBLISH FUNCTION
// ============================================================================

export async function publishQuest(
  questId: string,
  projectId: string
): Promise<PublishQuestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!getNetworkStatus()) {
    return {
      success: false,
      status: 'error',
      message: 'Cannot publish while offline',
      errors: ['Cannot publish while offline'],
      warnings: []
    };
  }

  const [existingProject] = await system.db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  if (!existingProject) {
    return {
      success: false,
      status: 'error',
      message: 'Project not found',
      errors: ['Project not found'],
      warnings: []
    };
  }

  try {
    const {
      data: { session }
    } = await system.supabaseConnector.client.auth.getSession();
    const userId = session?.user?.id;

    if (userId) {
      const { data: linkData, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('id')
        .eq('project_id', projectId)
        .eq('profile_id', userId)
        .in('membership', ['owner', 'member'])
        .eq('active', true)
        .limit(1);

      if (error) {
        warnings.push('Could not verify project membership in cloud');
      } else if (!linkData || linkData.length === 0) {
        return {
          success: false,
          status: 'error',
          message:
            'You must be a project owner or member to publish. The project may need to be published first.',
          errors: [
            'No active membership link found in cloud for this project'
          ],
          warnings: []
        };
      }
    }
  } catch {
    warnings.push(
      'Could not verify project membership — publish may fail with RLS error'
    );
  }

  const parentQuestIds = Array.from(
    new Set(
      (await getParentQuests(questId))
        .map((row) => row.id)
        .filter((id) => id !== questId)
    )
  );
  const nestedQuestsIds = Array.from(
    new Set((await getNestedQuests(questId)).map((row) => row.id))
  );
  if (!nestedQuestsIds.includes(questId)) {
    nestedQuestsIds.unshift(questId);
  }

  const allQuestIds = Array.from(new Set([...parentQuestIds, ...nestedQuestsIds]));
  const nestedAssetIds = Array.from(
    new Set(
      (await getNestedAssets(nestedQuestsIds)).map((row) => row.asset_id)
    )
  );

  try {
    const unpublishedQuests = await system.db
      .select({ id: quest.id })
      .from(quest)
      .where(and(inArray(quest.id, allQuestIds), isNull(quest.published_at)));
    const unpublishedQuestIds = unpublishedQuests.map((row) => row.id);

    if (unpublishedQuestIds.length === 0) {
      return {
        success: true,
        status: 'queued',
        message: 'Quest is already published',
        publishedQuestIds: allQuestIds,
        publishedAssetIds: nestedAssetIds,
        errors,
        warnings
      };
    }

    const publishedAt = new Date().toISOString();

    const audioUploadResults = await system.db.transaction(async (tx) => {
      await tx
        .update(quest)
        .set({ published_at: publishedAt })
        .where(
          and(inArray(quest.id, unpublishedQuestIds), isNull(quest.published_at))
        );

      const localAudioFilesForAssets =
        nestedAssetIds.length > 0
          ? await Promise.all(
              (
                await tx.query.asset_content_link.findMany({
                  columns: { audio: true },
                  where: and(
                    inArray(asset_content_link.asset_id, nestedAssetIds),
                    isNotNull(asset_content_link.audio)
                  )
                })
              )
                .flatMap((link) => link.audio ?? [])
                .filter((value): value is string => Boolean(value))
                .filter(isLocalOnlyAudio)
                .map(getLocalAttachmentUri)
            )
          : [];

      if (nestedAssetIds.length > 0) {
        await tx
          .update(asset_content_link)
          .set({
            audio: sql`REPLACE(${asset_content_link.audio}, 'local/', '')`
          })
          .where(inArray(asset_content_link.asset_id, nestedAssetIds));
      }

      return Promise.allSettled(
        localAudioFilesForAssets.map((audio) => promoteLocalAudio(audio))
      );
    });

    system.audioUploader?.trigger();

    const failedAudioResults = audioUploadResults.filter(
      (result) => result.status === 'rejected'
    );
    if (failedAudioResults.length > 0) {
      console.error('Failed to save audio attachments', failedAudioResults);
    }

    console.log('Quest published successfully');
    return {
      success: true,
      status: 'queued' as const,
      message: 'Quest published successfully',
      publishedQuestIds: unpublishedQuestIds,
      publishedAssetIds: nestedAssetIds,
      pendingAttachments: audioUploadResults.length,
      errors,
      warnings
    };
  } catch (error) {
    console.error('Failed to publish quest:', error);
    return {
      success: false,
      status: 'error' as const,
      message: 'Failed to publish quest',
      errors: [
        ...errors,
        error instanceof Error ? error.message : String(error)
      ],
      warnings
    };
  }
}
