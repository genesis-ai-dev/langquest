import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
import {
  asset,
  asset_content_link,
  profile_project_link,
  quest,
  quest_asset_link
} from '@/db/drizzleSchema';
import {
  asset_content_link_synced,
  asset_synced,
  profile_project_link_synced,
  project_synced,
  quest_asset_link_synced,
  quest_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { substituteParams } from '@/hooks/useHybridSupabaseQuery';
import type { WithSource } from '@/utils/dbUtils';
import { aliasedColumn } from '@/utils/dbUtils';
import { deleteFile, getLocalAttachmentUri } from '@/utils/fileUtils';
import {
  and,
  eq,
  getTableColumns as getTableColumnsDrizzle,
  inArray,
  isNotNull,
  sql
} from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderIcon,
  HardDriveIcon,
  Plus,
  Share2Icon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useItemDownload } from './useHybridData';

type Quest = typeof questTable.$inferSelect;

export interface QuestTreeRowProps {
  quest: WithSource<Quest>;
  projectId: string;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  onToggleExpand?: () => void;
  onAddChild: (parentId: string) => void;
}

async function getParentQuests(questId: string) {
  const parentQuests = system.db
    .select({
      id: quest.id,
      parent_id: quest.parent_id,
      depth: sql`0`.as('depth')
    })
    .from(quest)
    .where(and(eq(quest.id, questId), eq(quest.source, 'local')));

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
      .where(eq(quest.source, 'local'))
  );

  const query = sql`WITH RECURSIVE ${recursiveQueryName} AS ${recursiveQuery} 
  SELECT * FROM ${recursiveQueryName}
  ORDER BY ${parentQuestsAlias.depth}, ${parentQuestsAlias.id}`;

  const sqliteDialect = new SQLiteAsyncDialect();
  const sqliteQuery = sqliteDialect.sqlToQuery(query);
  console.log(
    'sqliteQuery',
    substituteParams(sqliteQuery.sql, sqliteQuery.params)
  );

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
    .where(and(eq(quest.id, questId), eq(quest.source, 'local')));

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
      .where(eq(quest.source, 'local'))
  );

  const query = sql`WITH RECURSIVE ${recursiveQueryName} AS ${recursiveQuery} 
  SELECT * FROM ${recursiveQueryName}
  ORDER BY ${nestedQuestsAlias.depth}, ${nestedQuestsAlias.id}`;

  const sqliteDialect = new SQLiteAsyncDialect();
  const sqliteQuery = sqliteDialect.sqlToQuery(query);
  console.log(
    'sqliteQuery',
    substituteParams(sqliteQuery.sql, sqliteQuery.params)
  );

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
    .innerJoin(quest_asset_link, eq(quest_asset_link.asset_id, asset.id))
    .where(
      and(
        inArray(quest_asset_link.quest_id, questIds),
        eq(asset.source, 'local')
      )
    );

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

  const sqliteDialect = new SQLiteAsyncDialect();
  const sqliteQuery = sqliteDialect.sqlToQuery(query);
  console.log(
    'sqliteQuery',
    substituteParams(sqliteQuery.sql, sqliteQuery.params)
  );

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

function toColumns(array: string[]) {
  return array.map((item) => `'${item}'`).join(', ');
}

async function publishQuest(questId: string, projectId: string) {
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

  const profileProjectLinksIds = (
    await system.db.query.profile_project_link.findMany({
      where: and(
        eq(profile_project_link.project_id, projectId),
        eq(profile_project_link.active, true),
        eq(profile_project_link.source, 'local')
      )
    })
  ).map((link) => link.profile_id);

  const localAudioFilesForAssets = (
    await system.db.query.asset_content_link.findMany({
      columns: {
        audio: true
      },
      where: and(
        inArray(asset_content_link.asset_id, nestedAssetIds),
        isNotNull(asset_content_link.audio)
      )
    })
  )
    .flatMap((link) => link.audio)
    .filter(Boolean)
    .map(getLocalAttachmentUri);

  await system.db.transaction(async (tx) => {
    const projectColumns = getTableColumns(project_synced);
    const projectQuery = `INSERT INTO project_synced(${projectColumns}) SELECT ${projectColumns} FROM project_local WHERE id = '${projectId}'`;
    console.log('projectQuery', projectQuery);
    await tx.run(sql.raw(projectQuery));

    await tx.run(
      sql.raw(`DELETE FROM project_local WHERE id = '${projectId}'`)
    );

    const profileProjectLinkColumns = getTableColumns(
      profile_project_link_synced
    );

    const profileProjectLinkQuery = `INSERT INTO profile_project_link_synced(${profileProjectLinkColumns}) SELECT ${profileProjectLinkColumns} FROM profile_project_link_local WHERE profile_id IN (${toColumns(profileProjectLinksIds)})`;
    console.log('profileProjectLinkQuery', profileProjectLinkQuery);
    await tx.run(sql.raw(profileProjectLinkQuery));

    await tx.run(
      sql.raw(
        `DELETE FROM profile_project_link_local WHERE profile_id IN (${toColumns(profileProjectLinksIds)})`
      )
    );

    const questColumns = getTableColumns(quest_synced);
    const questQuery = `INSERT INTO quest_synced(${questColumns}) SELECT ${questColumns} FROM quest_local WHERE id IN (${toColumns(parentQuestsIds.concat(nestedQuestsIds))})`;
    await tx.run(sql.raw(questQuery));

    await tx.run(
      sql.raw(
        `DELETE FROM quest_local WHERE id IN (${toColumns(parentQuestsIds.concat(nestedQuestsIds))})`
      )
    );

    const assetColumns = getTableColumns(asset_synced);
    const assetQuery = `INSERT INTO asset_synced(${assetColumns}) SELECT ${assetColumns} FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)})`;
    console.log('assetQuery', assetQuery);
    await tx.run(sql.raw(assetQuery));

    await tx.run(
      sql.raw(
        `DELETE FROM asset_local WHERE id IN (${toColumns(nestedAssetIds)})`
      )
    );

    const questAssetLinkColumns = getTableColumns(quest_asset_link_synced);
    const questAssetLinkQuery = `INSERT INTO quest_asset_link_synced(${questAssetLinkColumns}) SELECT ${questAssetLinkColumns} FROM quest_asset_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)})`;
    console.log('questAssetLinkQuery', questAssetLinkQuery);
    await tx.run(sql.raw(questAssetLinkQuery));

    await tx.run(
      sql.raw(
        `DELETE FROM quest_asset_link_local WHERE quest_id IN (${toColumns(nestedQuestsIds)})`
      )
    );

    const assetContentLinkColumns = getTableColumns(asset_content_link_synced);
    const assetContentLinkQuery = `INSERT INTO asset_content_link_synced(${assetContentLinkColumns}) SELECT ${assetContentLinkColumns} FROM asset_content_link_local WHERE asset_id IN (${toColumns(nestedAssetIds)})`;
    console.log('assetContentLinkQuery', assetContentLinkQuery);
    await tx.run(sql.raw(assetContentLinkQuery));

    await tx.run(
      sql.raw(`DELETE FROM asset_content_link_local WHERE asset_id IN (?)`),
      [nestedAssetIds]
    );

    const audioUploadResults = await Promise.allSettled(
      localAudioFilesForAssets.map(async (audio) => {
        const record = await system.permAttachmentQueue?.saveAudio(audio);
        if (!record?.size) throw new Error('Failed to save audio');
        return audio;
      })
    );

    const successfulAudioUploadResults = audioUploadResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    // Delete the local audio files after they have been moved to the perm attachment queue
    await Promise.all(
      localAudioFilesForAssets.map(async (audio) => {
        await deleteFile(audio);
      })
    );

    const failedAudioUploadResults = audioUploadResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason as string);

    console.log('successfulAudioUploadResults', successfulAudioUploadResults);
    console.log('failedAudioUploadResults', failedAudioUploadResults);

    if (failedAudioUploadResults.length > 0) {
      throw new Error('Failed to save audio attachments');
    }

    // TODO: upload image attachments if uploading images locally will be a thing
  });

  console.log('Quest published successfully');
}

export const QuestTreeRow: React.FC<QuestTreeRowProps> = ({
  quest,
  projectId,
  depth,
  hasChildren,
  isOpen,
  onToggleExpand,
  onAddChild
}) => {
  const { goToQuest, currentProjectId } = useAppNavigation();
  const { currentUser } = useAuth();

  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    quest.id
  );

  const Component = hasChildren ? Pressable : View;
  return (
    <View
      className="flex flex-row items-center gap-1 py-1"
      style={{ paddingLeft: depth * 12 }}
    >
      {(depth > 0 || hasChildren) && (
        <Component
          {...(hasChildren && { onPress: onToggleExpand })}
          className="w-8 p-1"
        >
          {hasChildren && (
            <Icon
              as={isOpen ? ChevronDown : ChevronRight}
              className="text-muted-foreground"
            />
          )}
        </Component>
      )}
      <View className="flex flex-row items-center gap-2">
        {quest.source === 'local' && (
          <Icon as={HardDriveIcon} className="text-muted-foreground" />
        )}
        <Icon as={FolderIcon} className="mr-2 text-muted-foreground" />
      </View>
      <Pressable
        className="flex-1 overflow-hidden"
        onPress={() =>
          goToQuest({
            id: quest.id,
            project_id: currentProjectId!,
            name: quest.name
          })
        }
      >
        <View className="flex flex-1 flex-row items-center gap-2">
          <View>
            <Text numberOfLines={1}>{quest.name}</Text>
          </View>
          {quest.description && (
            <View className="flex-1 truncate">
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {quest.description}
              </Text>
            </View>
          )}
        </View>
        {/* {!!quest.parent_id && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Parent: {quest.parent_id}
          </Text>
        )} */}
      </Pressable>
      {quest.source === 'local' ? (
        <View className="ml-2 flex flex-row items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onPress={() => {
              void publishQuest(quest.id, projectId);
            }}
          >
            <Icon as={Share2Icon} />
          </Button>
        </View>
      ) : quest.source === 'cloud' ? (
        <View className="ml-2 flex flex-row items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isDownloading || !currentUser?.id}
            onPress={() => {
              if (!currentUser?.id) return;
              downloadQuest({ userId: currentUser.id, download: true });
            }}
          >
            <Icon as={Download} />
          </Button>
        </View>
      ) : null}
      <Button
        size="icon"
        variant="outline"
        className="ml-2 size-7"
        onPress={() => onAddChild(quest.id)}
      >
        <Icon as={Plus} />
      </Button>
    </View>
  );
};

export default QuestTreeRow;
