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
import {
  and,
  eq,
  getTableColumns as getTableColumnsDrizzle,
  inArray,
  isNotNull,
  sql
} from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { aliasedColumn, toColumns } from './dbUtils';
import { getLocalAttachmentUri } from './fileUtils';

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
      // asset_id: quest_asset_link.asset_id,
      depth: sql`0`.as('depth')
    })
    .from(quest)
    // .leftJoin(quest_asset_link, eq(quest.id, quest_asset_link.quest_id))
    .where(and(eq(quest.id, questId)));

  const alias = 'nested_quests';
  const nestedQuestsAlias = nestedQuests.as(alias);
  const recursiveQueryName = sql.raw(`"${alias}"`);

  const recursiveQuery = nestedQuests.unionAll(
    system.db
      .select({
        id: quest.id,
        parent_id: quest.parent_id,
        // asset_id: quest_asset_link.asset_id,
        depth: sql`${nestedQuestsAlias.depth} + 1`
      })
      .from(quest)
      // .leftJoin(quest_asset_link, eq(quest.id, quest_asset_link.quest_id))
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

export async function publishQuest(questId: string, projectId: string) {
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

    // IMPORTANT: Insert ALL data in a SINGLE transaction to maintain ordering
    // PowerSync preserves the order of operations within a transaction
    // Order: project → profile_project_link → languoids → project_language_link → parent quests → child quests → assets → links
    const audioUploadResults = await system.db.transaction(async (tx) => {
      // Step 1: Insert project FIRST (required for foreign keys)
      // IDEMPOTENT: Use INSERT OR IGNORE to allow re-publishing
      const projectColumns = getTableColumns(project_synced);
      const projectQuery = `INSERT OR IGNORE INTO project_synced(${projectColumns}) SELECT ${projectColumns} FROM project_local WHERE id = '${projectId}' AND source = 'local'`;
      console.log('projectQuery', projectQuery);
      await tx.run(sql.raw(projectQuery));

      // Step 2: Insert profile_project_link (depends on project)
      // FIXED: Filter by specific link IDs to avoid uploading links for other projects
      if (profileProjectLinkIds.length > 0) {
        const profileProjectLinkColumns = getTableColumns(
          profile_project_link_synced
        );
        const profileProjectLinkQuery = `INSERT OR IGNORE INTO profile_project_link_synced(${profileProjectLinkColumns}) SELECT ${profileProjectLinkColumns} FROM profile_project_link_local WHERE id IN (${toColumns(profileProjectLinkIds)}) AND source = 'local'`;
        console.log('profileProjectLinkQuery', profileProjectLinkQuery);
        await tx.run(sql.raw(profileProjectLinkQuery));
      } else {
        console.log(
          '⏭️ No new profile_project_links to publish (already synced)'
        );
      }

      // Step 2b: Insert languoids FIRST (required for foreign key in project_language_link)
      if (languoidIds.length > 0) {
        const languoidColumns = getTableColumns(languoid_synced);
        const languoidQuery = `INSERT OR IGNORE INTO languoid_synced(${languoidColumns}) SELECT ${languoidColumns} FROM languoid_local WHERE id IN (${toColumns(languoidIds)}) AND source = 'local'`;
        console.log('languoidQuery', languoidQuery);
        await tx.run(sql.raw(languoidQuery));
      }

      // Step 2c: Insert project_language_link (depends on project and languoid)
      // PK is now (project_id, languoid_id, language_type) - languoid_id is required
      const projectLanguageLinkColumns = getTableColumns(
        project_language_link_synced
      );
      // Only publish links with languoid_id (required for PK)
      const projectLanguageLinkQuery = `INSERT OR IGNORE INTO project_language_link_synced(${projectLanguageLinkColumns}) SELECT ${projectLanguageLinkColumns} FROM project_language_link_local WHERE project_id = '${projectId}' AND languoid_id IS NOT NULL AND source = 'local'`;
      console.log('projectLanguageLinkQuery', projectLanguageLinkQuery);
      await tx.run(sql.raw(projectLanguageLinkQuery));

      // Step 3: Insert quests (parents first, then children)
      const questColumns = getTableColumns(quest_synced);

      // Combine all quest IDs for use throughout transaction
      const allQuestIds = Array.from(
        new Set([...parentQuestIds, ...nestedQuestsIds])
      );

      // Step 3a: Insert parent quests FIRST (order matters for foreign keys)
      if (parentQuestIds.length > 0) {
        const parentQuestQuery = `INSERT OR IGNORE INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(parentQuestIds)}) AND source = 'local'`;
        console.log('parentQuestQuery', parentQuestQuery);
        await tx.run(sql.raw(parentQuestQuery));
      }

      // Step 3b: Insert nested quests (children) - parents are now in queue first
      const nestedQuestQuery = `INSERT OR IGNORE INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`;
      console.log('nestedQuestQuery', nestedQuestQuery);
      await tx.run(sql.raw(nestedQuestQuery));

      // Step 4: Insert assets and related records
      const assetColumns = getTableColumns(asset_synced);
      const assetQuery = `INSERT OR IGNORE INTO asset_synced(${assetColumns}) SELECT ${assetColumns} FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      console.log('assetQuery', assetQuery);
      await tx.run(sql.raw(assetQuery));

      const questAssetLinkColumns = getTableColumns(quest_asset_link_synced);
      const questAssetLinkQuery = `INSERT OR IGNORE INTO quest_asset_link_synced(${questAssetLinkColumns}) SELECT ${questAssetLinkColumns} FROM quest_asset_link_local WHERE quest_id IN (${toColumns(allQuestIds)}) AND source = 'local'`;
      await tx.run(sql.raw(questAssetLinkQuery));

      const assetContentLinkColumns = getTableColumns(
        asset_content_link_synced
      );

      const localAudioFilesForAssets = await Promise.all(
        (
          await tx.query.asset_content_link.findMany({
            columns: {
              audio: true
            },
            where: and(
              inArray(asset_content_link.asset_id, nestedAssetIds),
              isNotNull(asset_content_link.audio),
              eq(asset_content_link.source, 'local')
            )
          })
        )
          .flatMap((link) => link.audio)
          .filter(Boolean)
          .map(getLocalAttachmentUri) // without OPFS
      );

      const assetContentLinkQuery = `INSERT OR IGNORE INTO asset_content_link_synced(${assetContentLinkColumns}) SELECT ${assetContentLinkColumns.replace(
        `audio,`,
        `REPLACE(audio, 'local/', '') AS audio,`
      )} FROM asset_content_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      console.log('assetContentLinkQuery', assetContentLinkQuery);
      await tx.run(sql.raw(assetContentLinkQuery));

      const tagsForQuests = (
        await tx.query.quest_tag_link.findMany({
          where: and(
            inArray(quest_tag_link.quest_id, allQuestIds),
            eq(quest_tag_link.source, 'local')
          ),
          columns: {
            tag_id: true
          }
        })
      ).map((link) => link.tag_id);

      const tagsForAssets = (
        await tx.query.asset_tag_link.findMany({
          where: and(
            inArray(asset_tag_link.asset_id, nestedAssetIds),
            eq(asset_tag_link.source, 'local')
          ),
          columns: {
            tag_id: true
          }
        })
      ).map((link) => link.tag_id);

      const allTagsIds = Array.from(
        new Set(tagsForQuests.concat(tagsForAssets))
      );

      // Check for tag key conflicts with online tags before inserting
      const localTags = await tx.query.tag.findMany({
        where: and(inArray(tag.id, allTagsIds), eq(tag.source, 'local')),
        columns: {
          id: true,
          key: true
        }
      });

      const localTagKeys = localTags.map((t) => t.key);

      let tagsToPublish = allTagsIds;

      if (localTagKeys.length > 0) {
        const { data: conflictingOnlineTags } =
          await system.supabaseConnector.client
            .from('tag')
            .select('key')
            .in('key', localTagKeys)
            .overrideTypes<{ key: string }[]>();

        if (conflictingOnlineTags && conflictingOnlineTags.length > 0) {
          const conflictingKeys = conflictingOnlineTags.map((t) => t.key);
          console.warn(
            `Skipping tags with conflicting keys that already exist online: ${conflictingKeys.join(', ')}`
          );

          // Filter out tags with conflicting keys
          const conflictingTagIds = localTags
            .filter((t) => conflictingKeys.includes(t.key))
            .map((t) => t.id);

          tagsToPublish = allTagsIds.filter(
            (id) => !conflictingTagIds.includes(id)
          );
        }
      }

      const tagColumns = getTableColumns(tag_synced);
      const tagQuery = `INSERT OR IGNORE INTO tag_synced(${tagColumns}) SELECT ${tagColumns} FROM tag_local WHERE id IN (${toColumns(tagsToPublish)}) AND source = 'local'`;
      await tx.run(sql.raw(tagQuery));

      const questTagLinkColumns = getTableColumns(quest_tag_link_synced);
      const questTagLinkQuery = `INSERT OR IGNORE INTO quest_tag_link_synced(${questTagLinkColumns}) SELECT ${questTagLinkColumns} FROM quest_tag_link_local WHERE quest_id IN (${toColumns(allQuestIds)}) AND source = 'local'`;
      await tx.run(sql.raw(questTagLinkQuery));

      const assetTagLinkColumns = getTableColumns(asset_tag_link_synced);
      const assetTagLinkQuery = `INSERT OR IGNORE INTO asset_tag_link_synced(${assetTagLinkColumns}) SELECT ${assetTagLinkColumns} FROM asset_tag_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      await tx.run(sql.raw(assetTagLinkQuery));

      console.log('localAudioFilesForAssets', localAudioFilesForAssets);

      const audioUploadResults = await Promise.allSettled(
        localAudioFilesForAssets.map(async (audio) => {
          const record = await system.permAttachmentQueue?.saveAudio(audio, tx);
          // easy way to tell if audio file exists locally
          if (!record?.size) {
            console.warn(
              `Will fail to add audio to perm attachment queue, could not find size for ${audio}`
            );
            return Promise.reject(
              new Error(
                `Will fail to add audio to perm attachment queue, could not find size for ${audio}`
              )
            );
          }
          return audio;
        })
      );

      // TODO: upload image attachments if uploading images locally will be a thin

      // ============================================================================
      // CRITICAL: LOCAL RECORDS ARE PRESERVED FOR DATA SAFETY
      // ============================================================================
      // We intentionally DO NOT delete local records during publishing.
      //
      // Reasons:
      // 1. PowerSync may fail to upload to Supabase (network issues, RLS errors, etc.)
      // 2. If we delete local records before confirming cloud upload, data loss can occur
      // 3. Local records serve as a backup if the remote database has issues
      //
      // Future cleanup strategy:
      // - Create a separate manual cleanup service (NOT part of publish flow)
      // - That service should:
      //   1. Query Supabase to confirm record exists
      //   2. Verify the data matches (checksums, timestamps, etc.)
      //   3. Only then delete from *_local tables
      // - Run cleanup manually or on a scheduled basis
      // - Never tie cleanup to PowerSync upload success (could be false positive)
      //
      // For now: Local records remain indefinitely as a safety measure.
      // ============================================================================

      return audioUploadResults;
    });

    const failedAudioUploadResults = audioUploadResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason as string);

    if (failedAudioUploadResults.length > 0) {
      console.error(
        'Failed to save audio attachments',
        failedAudioUploadResults
      );
    }

    console.log('Quest published successfully');
    return { success: true, message: 'Quest published successfully' };
  } catch (error) {
    console.error('Failed to publish quest:', error);
    return { success: false, message: 'Failed to publish quest' };
  }
}
