import { useAuth } from '@/contexts/AuthContext';
import {
  asset,
  blocked_content,
  blocked_users,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, or, sql } from 'drizzle-orm';

/**
 * Count how many translations (assets) are blocked for a given source asset
 */
export function useBlockedTranslationsCount(assetId: string) {
  const { currentUser } = useAuth();

  const { data: counts } = useHybridData({
    dataType: 'blocked-translations-count',
    queryKeyParams: [
      'blocked-count',
      'translations',
      assetId,
      currentUser?.id ?? ''
    ],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          blocked: sql<number>`COUNT(*)`
        })
        .from(asset)
        .where(
          and(
            eq(asset.source_asset_id, assetId),
            or(
              sql`EXISTS (
                SELECT 1 FROM ${blocked_content} 
                WHERE ${blocked_content.profile_id} = ${currentUser?.id ?? ''} 
                  AND ${blocked_content.content_table} = 'asset' 
                  AND ${blocked_content.content_id} = ${asset.id}
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${blocked_users} 
                WHERE ${blocked_users.blocker_id} = ${currentUser?.id ?? ''} 
                  AND ${blocked_users.blocked_id} = ${asset.creator_id}
              )`
            )
          )
        )
    ),
    enableOfflineQuery: !!(currentUser && assetId)
  });

  if (!currentUser || !assetId) return 0;

  const count = counts[0]?.blocked;
  return typeof count === 'number' ? count : 0;
}

/**
 * Count how many assets are blocked for a given quest
 */
export function useBlockedAssetsCount(questId: string) {
  const { currentUser } = useAuth();

  const { data: counts } = useHybridData({
    dataType: 'blocked-assets-count',
    queryKeyParams: ['blocked-count', 'assets', questId, currentUser?.id ?? ''],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          blocked: sql<number>`COUNT(*)`
        })
        .from(asset)
        .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
        .where(
          and(
            eq(quest_asset_link.quest_id, questId),
            or(
              sql`EXISTS (
                SELECT 1 FROM ${blocked_content} 
                WHERE ${blocked_content.profile_id} = ${currentUser?.id ?? ''} 
                  AND ${blocked_content.content_table} = 'asset' 
                  AND ${blocked_content.content_id} = ${asset.id}
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${blocked_users} 
                WHERE ${blocked_users.blocker_id} = ${currentUser?.id ?? ''} 
                  AND ${blocked_users.blocked_id} = ${asset.creator_id}
              )`
            )
          )
        )
    ),
    enableOfflineQuery: !!(currentUser && questId)
  });

  if (!currentUser || !questId) return 0;

  const count = counts[0]?.blocked;
  return typeof count === 'number' ? count : 0;
}
