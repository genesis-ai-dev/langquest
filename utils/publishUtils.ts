import {
  asset,
  asset_content_link,
  asset_tag_link,
  profile_project_link,
  quest,
  quest_asset_link,
  quest_tag_link
} from '@/db/drizzleSchema';
import {
  asset_content_link_synced,
  asset_synced,
  asset_tag_link_synced,
  profile_project_link_synced,
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
  const parentQuestsIds = Array.from(
    new Set((await getParentQuests(questId)).map((quest) => quest.id))
  );
  const nestedQuestsIds = Array.from(
    new Set((await getNestedQuests(questId)).map((quest) => quest.id))
  );
  const nestedAssetIds = Array.from(
    new Set(
      (await getNestedAssets(nestedQuestsIds)).map((asset) => asset.asset_id)
    )
  );

  try {
    const audioUploadResults = await system.db.transaction(async (tx) => {
      const projectColumns = getTableColumns(project_synced);
      const projectQuery = `INSERT INTO project_synced(${projectColumns}) SELECT ${projectColumns} FROM project_local WHERE id = '${projectId}' AND source = 'local'`;
      console.log('projectQuery', projectQuery);
      await tx.run(sql.raw(projectQuery));

      const profileProjectLinkColumns = getTableColumns(
        profile_project_link_synced
      );

      const profileProjectLinksIds = (
        await tx.query.profile_project_link.findMany({
          where: and(
            eq(profile_project_link.project_id, projectId),
            eq(profile_project_link.active, true),
            eq(profile_project_link.source, 'local')
          )
        })
      ).map((link) => link.profile_id);

      const profileProjectLinkQuery = `INSERT INTO profile_project_link_synced(${profileProjectLinkColumns}) SELECT ${profileProjectLinkColumns} FROM profile_project_link_local WHERE profile_id IN (${toColumns(profileProjectLinksIds)}) AND source = 'local'`;
      console.log('profileProjectLinkQuery', profileProjectLinkQuery);
      await tx.run(sql.raw(profileProjectLinkQuery));

      const questColumns = getTableColumns(quest_synced);
      const questQuery = `INSERT INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(parentQuestsIds.concat(nestedQuestsIds))}) AND source = 'local'`;
      await tx.run(sql.raw(questQuery));

      const assetColumns = getTableColumns(asset_synced);
      const assetQuery = `INSERT INTO asset_synced(${assetColumns}) SELECT ${assetColumns} FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      console.log('assetQuery', assetQuery);
      await tx.run(sql.raw(assetQuery));

      const questAssetLinkColumns = getTableColumns(quest_asset_link_synced);
      const questAssetLinkQuery = `INSERT INTO quest_asset_link_synced(${questAssetLinkColumns}) SELECT ${questAssetLinkColumns} FROM quest_asset_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`;
      console.log('questAssetLinkQuery', questAssetLinkQuery);
      await tx.run(sql.raw(questAssetLinkQuery));

      const assetContentLinkColumns = getTableColumns(
        asset_content_link_synced
      );
      const assetContentLinkQuery = `INSERT INTO asset_content_link_synced(${assetContentLinkColumns}) SELECT ${assetContentLinkColumns.replace(
        `audio,`,
        `REPLACE(audio, 'local/', '') AS audio,`
      )} FROM asset_content_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      console.log('assetContentLinkQuery', assetContentLinkQuery);
      await tx.run(sql.raw(assetContentLinkQuery));

      const tagsForQuests = (
        await tx.query.quest_tag_link.findMany({
          where: and(
            inArray(quest_tag_link.quest_id, nestedQuestsIds),
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

      const tagColumns = getTableColumns(tag_synced);
      const tagQuery = `INSERT INTO tag_synced(${tagColumns}) SELECT ${tagColumns} FROM tag_local WHERE id IN (${toColumns(allTagsIds)}) AND source = 'local'`;
      await tx.run(sql.raw(tagQuery));

      const questTagLinkColumns = getTableColumns(quest_tag_link_synced);
      const questTagLinkQuery = `INSERT INTO quest_tag_link_synced(${questTagLinkColumns}) SELECT ${questTagLinkColumns} FROM quest_tag_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`;
      await tx.run(sql.raw(questTagLinkQuery));

      const assetTagLinkColumns = getTableColumns(asset_tag_link_synced);
      const assetTagLinkQuery = `INSERT INTO asset_tag_link_synced(${assetTagLinkColumns}) SELECT ${assetTagLinkColumns} FROM asset_tag_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`;
      await tx.run(sql.raw(assetTagLinkQuery));

      const localAudioFilesForAssets = (
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
        .map(getLocalAttachmentUri);

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

      await tx.run(
        sql.raw(
          `DELETE FROM project_local WHERE id = '${projectId}' AND source = 'local'`
        )
      );

      await tx.run(
        sql.raw(
          `DELETE FROM profile_project_link_local WHERE profile_id IN (${toColumns(profileProjectLinksIds)}) AND source = 'local'`
        )
      );
      await tx.run(
        sql.raw(
          `DELETE FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`
        )
      );
      await tx.run(
        sql.raw(
          `DELETE FROM quest_asset_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`
        )
      );

      await tx.run(
        sql.raw(
          `DELETE FROM asset_content_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`
        )
      );

      // await tx.run(
      //   sql.raw(
      //     `DELETE FROM tag_local WHERE source = 'local'`
      //   )
      // );

      await tx.run(
        sql.raw(
          `DELETE FROM quest_tag_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)}) AND source = 'local'`
        )
      );

      await tx.run(
        sql.raw(
          `DELETE FROM asset_tag_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)}) AND source = 'local'`
        )
      );

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
  } catch (error) {
    console.error('Failed to publish quest:', error);
  }
}
