import { useAuth } from '@/contexts/AuthContext';
import type {
  blocked_content,
  language,
  quest_asset_link
} from '@/db/drizzleSchema';
import { asset, asset_content_link, vote } from '@/db/drizzleSchema';
import type { project_synced, quest_synced } from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import type { SortOrder } from '@/utils/dbUtils';
import { blockedContentQuery, blockedUsersQuery } from '@/utils/dbUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import {
  and,
  eq,
  getOrderByOperators,
  getTableColumns,
  notInArray,
  sql
} from 'drizzle-orm';

export type Asset = InferSelectModel<typeof asset>;
export type Vote = InferSelectModel<typeof vote>;
export type Language = InferSelectModel<typeof language>;
export type QuestAssetLink = InferSelectModel<typeof quest_asset_link>;
export type Quest = InferSelectModel<typeof quest_synced>;
export type Project = InferSelectModel<typeof project_synced>;
export type BlockedContent = InferSelectModel<typeof blocked_content>;

export type AssetWithVoteCount = Asset & {
  text: string | null;
  audio: string[] | null;
  up_votes: number;
  down_votes: number;
  net_votes: number;
};

// export function useTranslationsByAssetId(asset_id: string) {
//   const { db } = system;
//   const { currentUser } = useAuth();
//   const queryClient = useQueryClient();

//   const invalidate = () =>
//     void queryClient.invalidateQueries({
//       queryKey: [
//         'translations',
//         'by-asset',
//         asset_id,
//         currentUser?.id || 'anonymous'
//       ]
//     });

//   useEffect(() => {
//     const abortController = new AbortController();

//     db.watch(
//       db.query.translation.findMany({
//         where: eq(translation.asset_id, asset_id),
//         columns: {}
//       }),
//       {
//         onResult: invalidate
//       }
//     );

//     db.watch(
//       db
//         .select({})
//         .from(blocked_content)
//         .innerJoin(translation, eq(blocked_content.content_id, translation.id))
//         .where(
//           and(
//             eq(blocked_content.profile_id, currentUser?.id || ''),
//             eq(blocked_content.content_table, 'translations'),
//             eq(translation.asset_id, asset_id)
//           )
//         ),
//       {
//         onResult: invalidate
//       }
//     );

//     db.watch(
//       db
//         .select({})
//         .from(blocked_users)
//         .innerJoin(
//           translation,
//           eq(blocked_users.blocked_id, translation.creator_id)
//         )
//         .where(eq(translation.asset_id, asset_id)),
//       {
//         onResult: invalidate
//       }
//     );

//     return () => {
//       abortController.abort();
//     };
//   }, [asset_id, currentUser?.id, db]);

//   const {
//     data: translations,
//     isLoading: isTranslationsLoading,
//     ...rest
//   } = useHybridSupabaseRealtimeQuery({
//     ...getTranslationsByAssetIdConfig(asset_id, currentUser?.id),
//     channelName: 'public:translation',
//     subscriptionConfig: {
//       table: 'translation',
//       schema: 'public'
//     }
//   });

//   return { translations, isTranslationsLoading, ...rest };
// }

export function useTargetAssetsWithVoteCountByAssetId(
  asset_id: string,
  retrieveHiddenContent: boolean,
  translationsRefreshKey: string,
  voteRefreshKey: string,
  useOfflineData: boolean,
  sort: 'voteCount' | 'dateSubmitted',
  sortOrder: SortOrder = 'desc',
  contentTypeFilter: 'translation' | 'transcription' = 'translation'
) {
  const { sql: _, ...operators } = getOrderByOperators();
  const { currentUser } = useAuth();

  const conditions = [
    eq(asset.source_asset_id, asset_id),
    eq(asset.content_type, contentTypeFilter),
    !retrieveHiddenContent && eq(asset.visible, true),
    // Only filter blocked content/users if user is authenticated
    currentUser?.id &&
      notInArray(asset.id, blockedContentQuery(currentUser.id, 'asset')),
    currentUser?.id &&
      notInArray(asset.creator_id, blockedUsersQuery(currentUser.id))
  ];

  const {
    data: rawData,
    isLoading: isTranslationsLoading,
    offlineError: translationsOfflineError
    // cloudError: translationsCloudError
  } = useHybridData({
    dataType: 'target_assets',
    queryKeyParams: [
      asset_id,
      translationsRefreshKey || 0,
      voteRefreshKey,
      sort,
      sortOrder,
      contentTypeFilter
    ],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(asset),
          text: asset_content_link.text,
          audio: asset_content_link.audio,
          content_created_at: sql`${asset_content_link.created_at}`.as(
            'content_created_at'
          ),
          up_votes: sql<number>`SUM(
            CASE
              WHEN ${vote.polarity} = 'up'
              AND ${vote.active} = 1 THEN 1
              ELSE 0
            END
          )`.as('up_votes'),
          down_votes: sql<number>`SUM(
            CASE
              WHEN ${vote.polarity} = 'down'
              AND ${vote.active} = 1 THEN 1
              ELSE 0
            END
          )`.as('down_votes'),
          net_votes: sql<number>`SUM(
            CASE
              WHEN ${vote.polarity} = 'up' AND ${vote.active} = 1 THEN 1
              WHEN ${vote.polarity} = 'down' AND ${vote.active} = 1 THEN -1
              ELSE 0
            END
          )`.as('net_votes')
        })
        .from(asset)
        .leftJoin(vote, eq(vote.asset_id, asset.id))
        .leftJoin(asset_content_link, eq(asset_content_link.asset_id, asset.id))
        .where(and(...conditions.filter(Boolean)))
        .groupBy(asset_content_link.id)
        .orderBy(
          asset_content_link.created_at,
          sort === 'dateSubmitted'
            ? operators[sortOrder](asset.created_at)
            : operators[sortOrder](sql`net_votes`)
        )
    ),

    // Cloud query function - fetch translations (assets with source_asset_id) from Supabase
    cloudQueryFn: async () => {
      let query = system.supabaseConnector.client.from('asset').select(
        `
          *,
          up_votes:vote(count).filter(polarity,eq.up).filter(active,eq.true),
          down_votes:vote(count).filter(polarity,eq.down).filter(active,eq.true),
          net_votes:vote(count).filter(active,eq.true),
          text:asset_content_link(text),
          audio:asset_content_link(audio),
          content_created_at:asset_content_link(created_at)
        `
      );

      // Filter by source asset and content type
      query = query
        .eq('source_asset_id', asset_id)
        .eq('content_type', contentTypeFilter);

      // Filter by visibility if not retrieving hidden content
      if (!retrieveHiddenContent) {
        query = query.eq('visible', true);
      }

      // Add sorting - for vote count, we'll sort client-side
      query = query.order('created_at', {
        ascending: sortOrder === 'asc'
      });

      const { data, error } = await query.overrideTypes<
        (AssetWithVoteCount & {
          text?: string[];
          audio?: string[];
        })[]
      >();

      if (error) throw error;

      // Transform data to match expected format and apply vote-based sorting if needed
      let transformedData = data.map((item) => {
        // Calculate net_votes if not provided
        const netVotes =
          item.net_votes || 0 || (item.up_votes || 0) - (item.down_votes || 0);

        return {
          ...item,
          net_votes: netVotes,
          up_votes: item.up_votes || 0,
          down_votes: item.down_votes || 0,
          // Handle text and audio as arrays from the nested select
          text: Array.isArray(item.text) ? item.text[0] : item.text || '',
          audio: Array.isArray(item.audio)
            ? item.audio.filter(Boolean)
            : item.audio
              ? [item.audio]
              : null
        } as AssetWithVoteCount;
      });

      // Client-side sorting for vote count (Supabase doesn't support sorting by aggregated fields easily)
      if (sort === 'voteCount') {
        transformedData = transformedData.sort((a, b) => {
          const diff = (b.net_votes || 0) - (a.net_votes || 0);
          return sortOrder === 'asc' ? -diff : diff;
        });
      }

      return transformedData;
    },

    // Enable cloud query for anonymous users or when not using offline data
    enableCloudQuery: !useOfflineData
  });

  // Aggregate the content for each asset
  const translations = rawData.reduce<Record<string, (typeof rawData)[number]>>(
    (acc, { text, ...row }) => {
      const audio = [...(acc[row.id]?.audio ?? []), ...(row.audio ?? [])];
      acc[row.id] = {
        ...row,
        text: acc[row.id]?.text ?? text, // keep only the first text from the asset_content_links
        audio: audio.length > 0 ? audio : null,
        up_votes: row.up_votes,
        down_votes: row.down_votes,
        net_votes: row.net_votes
      };
      return acc;
    },
    {}
  );

  const translationsArray = Object.values(translations);

  return {
    data: translationsArray,
    isLoading: isTranslationsLoading,
    // hasError: useOfflineData
    //   ? translationsOfflineError || hasRestrictionsError
    //   : translationsCloudError || hasRestrictionsError
    hasError: !!translationsOfflineError
  };
}
