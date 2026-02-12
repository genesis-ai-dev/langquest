import {
  asset,
  asset_content_link,
  asset_tag_link,
  profile_project_link,
  project_language_link,
  quest,
  quest_asset_link,
  quest_tag_link,
  tag
} from '@/db/drizzleSchema';
import {
  asset_content_link_synced,
  asset_synced,
  asset_tag_link_synced,
  languoid_synced,
  profile_project_link_synced,
  project_language_link_synced,
  project_synced,
  quest_asset_link_synced,
  quest_synced,
  quest_tag_link_synced,
  tag_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  and,
  eq,
  getTableColumns as getTableColumnsDrizzle,
  inArray,
  isNotNull,
  sql
} from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { aliasedColumn, resolveTable, toColumns } from './dbUtils';
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

function getTableColumns<T extends SQLiteTable>(table: T) {
  return Object.keys(getTableColumnsDrizzle(table))
    .filter((column) => column !== 'source')
    .join(', ');
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

  // ==========================================================================
  // PHASE 1: VALIDATE (fail-fast, no DB writes)
  // ==========================================================================

  // 1a. Offline check
  if (!getNetworkStatus()) {
    return {
      success: false,
      status: 'error',
      message: 'Cannot publish while offline',
      errors: ['Cannot publish while offline'],
      warnings: []
    };
  }

  // 1b. Project existence — check local, then synced
  const projectLocal = resolveTable('project', { localOverride: true });
  const [projectInLocal] = await system.db
    .select({ id: projectLocal.id })
    .from(projectLocal)
    .where(eq(projectLocal.id, projectId))
    .limit(1);

  const isLocalProject = !!projectInLocal;

  if (!isLocalProject) {
    const projectSynced = resolveTable('project', { localOverride: false });
    const [projectInSynced] = await system.db
      .select({ id: projectSynced.id })
      .from(projectSynced)
      .where(eq(projectSynced.id, projectId))
      .limit(1);

    if (!projectInSynced) {
      return {
        success: false,
        status: 'error',
        message: 'Project not found in local or synced tables',
        errors: ['Project not found in local or synced tables'],
        warnings: []
      };
    }
  }

  // 1c. RLS membership pre-check (only when project is already published)
  if (!isLocalProject) {
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
  }

  // ==========================================================================
  // PHASE 2: GATHER (recursive CTEs)
  // ==========================================================================

  const parentQuestIds = Array.from(
    new Set(
      (await getParentQuests(questId))
        .map((quest) => quest.id)
        .filter((q) => q !== questId)
    )
  );
  const nestedQuestsIds = Array.from(
    new Set(
      (await getNestedQuests(questId))
        .map((quest) => quest.id)
        .filter((q) => q !== questId)
    )
  );
  nestedQuestsIds.unshift(questId);
  console.log('nestedQuestsIds', nestedQuestsIds);
  const nestedAssetIds = Array.from(
    new Set(
      (await getNestedAssets(nestedQuestsIds)).map((asset) => asset.asset_id)
    )
  );

  try {
    // Gather profile_project_link records for this specific project
    // CRITICAL: We collect link IDs (not profile_ids) to ensure we only publish
    // links for THIS project, not all projects the user is a member of
    const profileProjectLinks =
      await system.db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.active, true),
          eq(profile_project_link.source, 'local')
        )
      });
    const profileProjectLinkIds = profileProjectLinks.map((link) => link.id);

    const projectLanguageLinks =
      await system.db.query.project_language_link.findMany({
        where: and(
          eq(project_language_link.project_id, projectId),
          isNotNull(project_language_link.languoid_id),
          eq(project_language_link.source, 'local')
        ),
        columns: {
          languoid_id: true
        }
      });

    const languoidIds = Array.from(
      new Set(projectLanguageLinks.map((link) => link.languoid_id))
    );

    // Combine all quest IDs
    const allQuestIds = Array.from(
      new Set([...parentQuestIds, ...nestedQuestsIds])
    );

    // Gather tag IDs
    const tagsForQuests = (
      await system.db.query.quest_tag_link.findMany({
        where: and(
          inArray(quest_tag_link.quest_id, allQuestIds),
          eq(quest_tag_link.source, 'local')
        ),
        columns: { tag_id: true }
      })
    ).map((link) => link.tag_id);

    const tagsForAssets =
      nestedAssetIds.length > 0
        ? (
            await system.db.query.asset_tag_link.findMany({
              where: and(
                inArray(asset_tag_link.asset_id, nestedAssetIds),
                eq(asset_tag_link.source, 'local')
              ),
              columns: { tag_id: true }
            })
          ).map((link) => link.tag_id)
        : [];

    const allTagIds = Array.from(new Set(tagsForQuests.concat(tagsForAssets)));

    // Check for tag key conflicts with online tags before inserting
    const localTags = await system.db.query.tag.findMany({
      where: and(inArray(tag.id, allTagIds), eq(tag.source, 'local')),
      columns: { id: true, key: true }
    });

    const localTagKeys = localTags.map((t) => t.key);
    let tagsToPublish = allTagIds;

    if (localTagKeys.length > 0) {
      const { data: conflictingOnlineTags } =
        await system.supabaseConnector.client
          .from('tag')
          .select('key')
          .in('key', localTagKeys)
          .overrideTypes<{ key: string }[]>();

      if (conflictingOnlineTags && conflictingOnlineTags.length > 0) {
        const conflictingKeys = conflictingOnlineTags.map((t) => t.key);
        warnings.push(
          `Skipping tags with conflicting keys: ${conflictingKeys.join(', ')}`
        );

        const conflictingTagIds = localTags
          .filter((t) => conflictingKeys.includes(t.key))
          .map((t) => t.id);

        tagsToPublish = allTagIds.filter(
          (id) => !conflictingTagIds.includes(id)
        );
      }
    }

    // ========================================================================
    // PHASE 3: TRANSACT (single atomic transaction, bulk SQL)
    // ========================================================================

    // IMPORTANT: Insert ALL data in a SINGLE transaction to maintain ordering
    // PowerSync preserves the order of operations within a transaction
    // Order: project → profile_project_link → languoids → project_language_link
    //        → parent quests → child quests → assets → links
    const audioUploadResults = await system.db.transaction(async (tx) => {
      // 1. Insert project (required for foreign keys)
      const projectColumns = getTableColumns(project_synced);
      const projectQuery = `INSERT OR IGNORE INTO project_synced(${projectColumns}) SELECT ${projectColumns} FROM project_local WHERE id = '${projectId}' AND source = 'local'`;
      await tx.run(sql.raw(projectQuery));

      // 2. Insert profile_project_link (depends on project)
      if (profileProjectLinkIds.length > 0) {
        const profileProjectLinkColumns = getTableColumns(
          profile_project_link_synced
        );
        const profileProjectLinkQuery = `INSERT OR IGNORE INTO profile_project_link_synced(${profileProjectLinkColumns}) SELECT ${profileProjectLinkColumns} FROM profile_project_link_local WHERE id IN (${toColumns(profileProjectLinkIds)}) AND source = 'local'`;
        await tx.run(sql.raw(profileProjectLinkQuery));
      }

      // 3. Insert languoids (required for FK in project_language_link)
      if (languoidIds.length > 0) {
        const languoidColumns = getTableColumns(languoid_synced);
        const languoidQuery = `INSERT OR IGNORE INTO languoid_synced(${languoidColumns}) SELECT ${languoidColumns} FROM languoid_local WHERE id IN (${toColumns(languoidIds)}) AND source = 'local'`;
        await tx.run(sql.raw(languoidQuery));
      }

      // 4. Insert project_language_link (depends on project and languoid)
      const projectLanguageLinkColumns = getTableColumns(
        project_language_link_synced
      );
      const projectLanguageLinkQuery = `INSERT OR IGNORE INTO project_language_link_synced(${projectLanguageLinkColumns}) SELECT ${projectLanguageLinkColumns} FROM project_language_link_local WHERE project_id = '${projectId}' AND languoid_id IS NOT NULL AND source = 'local'`;
      await tx.run(sql.raw(projectLanguageLinkQuery));

      // 5. Insert quests (parents first, then target + children)
      const questColumns = getTableColumns(quest_synced);

      if (parentQuestIds.length > 0) {
        const parentQuestQuery = `INSERT OR IGNORE INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(parentQuestIds)}) AND source = 'local'`;
        await tx.run(sql.raw(parentQuestQuery));
      }

      const nestedQuestQuery = `INSERT OR IGNORE INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`;
      await tx.run(sql.raw(nestedQuestQuery));

      // 6. Insert assets (source assets first, then children with EXISTS check)
      const assetColumns = getTableColumns(asset_synced);

      const sourceAssetQuery = `INSERT OR IGNORE INTO asset_synced(${assetColumns}) SELECT ${assetColumns} FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)}) AND source = 'local' AND source_asset_id IS NULL`;
      await tx.run(sql.raw(sourceAssetQuery));

      const childAssetQuery = `INSERT OR IGNORE INTO asset_synced(${assetColumns})
        SELECT ${assetColumns
          .split(', ')
          .map((c) => `child.${c}`)
          .join(', ')}
        FROM asset_local child
        WHERE child.id IN (${toColumns(nestedAssetIds)})
          AND child.source = 'local'
          AND child.source_asset_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM asset_local parent WHERE parent.id = child.source_asset_id)`;
      await tx.run(sql.raw(childAssetQuery));

      // 7. Insert quest_asset_link (with EXISTS(asset) guard)
      const questAssetLinkColumns = getTableColumns(quest_asset_link_synced);
      const questAssetLinkQuery = `INSERT OR IGNORE INTO quest_asset_link_synced(${questAssetLinkColumns})
        SELECT ${questAssetLinkColumns
          .split(', ')
          .map((c) => `qal.${c}`)
          .join(', ')}
        FROM quest_asset_link_local qal
        WHERE qal.quest_id IN (${toColumns(allQuestIds)})
          AND qal.source = 'local'
          AND EXISTS (SELECT 1 FROM asset_local a WHERE a.id = qal.asset_id)`;
      await tx.run(sql.raw(questAssetLinkQuery));

      // 8. Insert asset_content_link (with EXISTS(asset) guard + REPLACE audio)
      const assetContentLinkColumns = getTableColumns(
        asset_content_link_synced
      );

      const localAudioFilesForAssets =
        nestedAssetIds.length > 0
          ? await Promise.all(
              (
                await tx.query.asset_content_link.findMany({
                  columns: { audio: true },
                  where: and(
                    inArray(asset_content_link.asset_id, nestedAssetIds),
                    isNotNull(asset_content_link.audio),
                    eq(asset_content_link.source, 'local')
                  )
                })
              )
                .flatMap((link) => link.audio)
                .filter(Boolean)
                .map(getLocalAttachmentUri)
            )
          : [];

      const aclColumnsPrefixed = assetContentLinkColumns
        .split(', ')
        .map((col) => {
          if (col === 'audio') {
            return `REPLACE(acl.audio, 'local/', '') AS audio`;
          }
          return `acl.${col}`;
        })
        .join(', ');
      const assetContentLinkQuery = `INSERT OR IGNORE INTO asset_content_link_synced(${assetContentLinkColumns})
        SELECT ${aclColumnsPrefixed}
        FROM asset_content_link_local acl
        WHERE acl.asset_id IN (${toColumns(nestedAssetIds)})
          AND acl.source = 'local'
          AND EXISTS (SELECT 1 FROM asset_local a WHERE a.id = acl.asset_id)`;
      await tx.run(sql.raw(assetContentLinkQuery));

      // 9. Insert tags
      const tagColumns = getTableColumns(tag_synced);
      const tagQuery = `INSERT OR IGNORE INTO tag_synced(${tagColumns}) SELECT ${tagColumns} FROM tag_local WHERE id IN (${toColumns(tagsToPublish)}) AND source = 'local'`;
      await tx.run(sql.raw(tagQuery));

      // 10. Insert quest_tag_link (with EXISTS(quest) AND EXISTS(tag))
      const questTagLinkColumns = getTableColumns(quest_tag_link_synced);
      const questTagLinkQuery = `INSERT OR IGNORE INTO quest_tag_link_synced(${questTagLinkColumns})
        SELECT ${questTagLinkColumns
          .split(', ')
          .map((c) => `qtl.${c}`)
          .join(', ')}
        FROM quest_tag_link_local qtl
        WHERE qtl.quest_id IN (${toColumns(allQuestIds)})
          AND qtl.source = 'local'
          AND EXISTS (SELECT 1 FROM quest_local q WHERE q.id = qtl.quest_id)
          AND EXISTS (SELECT 1 FROM tag_local t WHERE t.id = qtl.tag_id)`;
      await tx.run(sql.raw(questTagLinkQuery));

      // 11. Insert asset_tag_link (with EXISTS(asset) AND EXISTS(tag))
      const assetTagLinkColumns = getTableColumns(asset_tag_link_synced);
      const assetTagLinkQuery = `INSERT OR IGNORE INTO asset_tag_link_synced(${assetTagLinkColumns})
        SELECT ${assetTagLinkColumns
          .split(', ')
          .map((c) => `atl.${c}`)
          .join(', ')}
        FROM asset_tag_link_local atl
        WHERE atl.asset_id IN (${toColumns(nestedAssetIds)})
          AND atl.source = 'local'
          AND EXISTS (SELECT 1 FROM asset_local a WHERE a.id = atl.asset_id)
          AND EXISTS (SELECT 1 FROM tag_local t WHERE t.id = atl.tag_id)`;
      await tx.run(sql.raw(assetTagLinkQuery));

      // Queue audio attachments for upload
      const audioUploadResults = await Promise.allSettled(
        localAudioFilesForAssets.map(async (audio) => {
          const record = await system.permAttachmentQueue?.saveAudio(audio, tx);
          if (!record?.size) {
            return Promise.reject(
              new Error(`Could not find size for audio attachment: ${audio}`)
            );
          }
          return audio;
        })
      );

      return audioUploadResults;
    });

    // ========================================================================
    // PHASE 4: REPORT
    // ========================================================================

    const failedAudioResults = audioUploadResults.filter(
      (result) => result.status === 'rejected'
    );

    if (failedAudioResults.length > 0) {
      console.error('Failed to save audio attachments', failedAudioResults);
      return {
        success: false,
        status: 'error' as const,
        message: `Failed to save ${failedAudioResults.length} audio attachment(s)`,
        errors: [...errors, ...failedAudioResults.map((r) => String(r.reason))],
        warnings
      };
    }

    const pendingAttachments = audioUploadResults.length;

    console.log('Quest published successfully');
    return {
      success: true,
      status: 'queued' as const,
      message: 'Quest published successfully',
      publishedQuestIds: [...parentQuestIds, ...nestedQuestsIds],
      publishedAssetIds: nestedAssetIds,
      publishedProjectId: isLocalProject ? projectId : undefined,
      pendingAttachments,
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
