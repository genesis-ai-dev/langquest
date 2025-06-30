import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { asset, quest_asset_link, translation, vote } from '@/db/drizzleSchema';
import { calculateQuestProgress } from '@/utils/progressUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq, inArray } from 'drizzle-orm';
import { useMemo } from 'react';

export const useQuestProgress = (questId: string) => {
  const { db } = useSystem();
  const { currentUser } = useAuth();

  // Query 1: Get all asset IDs for this quest
  const { data: assetLinks = [], isLoading: isLoadingAssets } = useQuery({
    queryKey: ['quest-asset-links', questId],
    query: toCompilableQuery(
      db
        .select({ asset_id: quest_asset_link.asset_id })
        .from(quest_asset_link)
        .where(eq(quest_asset_link.quest_id, questId))
    ),
    enabled: !!questId
  });

  const assetIds = useMemo(
    () => assetLinks.map((link) => link.asset_id),
    [assetLinks]
  );

  // Query 2: Get all assets for the quest
  const { data: assets = [], isLoading: isLoadingAssetDetails } = useQuery({
    queryKey: ['quest-assets', assetIds],
    query: toCompilableQuery(
      db
        .select()
        .from(asset)
        .where(inArray(asset.id, assetIds.length > 0 ? assetIds : ['']))
    ),
    enabled: assetIds.length > 0
  });

  // Query 3: Get all translations for these assets
  const { data: translations = [], isLoading: isLoadingTranslations } =
    useQuery({
      queryKey: ['quest-translations', assetIds],
      query: toCompilableQuery(
        db
          .select()
          .from(translation)
          .where(
            and(
              inArray(
                translation.asset_id,
                assetIds.length > 0 ? assetIds : ['']
              ),
              eq(translation.visible, true)
            )
          )
      ),
      enabled: assetIds.length > 0
    });

  // Get unique translation IDs
  const translationIds = useMemo(
    () => translations.map((t) => t.id),
    [translations]
  );

  // Query 4: Get all votes for these translations
  const { data: votes = [], isLoading: isLoadingVotes } = useQuery({
    queryKey: ['quest-votes', translationIds],
    query: toCompilableQuery(
      db
        .select({
          id: vote.id,
          translation_id: vote.translation_id,
          polarity: vote.polarity,
          creator_id: vote.creator_id
        })
        .from(vote)
        .where(
          inArray(
            vote.translation_id,
            translationIds.length > 0 ? translationIds : ['']
          )
        )
    ),
    enabled: translationIds.length > 0
  });

  // Calculate progress when all data is loaded
  const progress = useMemo(() => {
    if (assetIds.length === 0) {
      return {
        approvedPercentage: 0,
        userContributedPercentage: 0,
        pendingTranslationsCount: 0,
        totalAssets: 0,
        approvedAssets: 0,
        userContributedAssets: 0
      };
    }

    // Group translations by asset
    const translationsByAsset = translations.reduce<
      Record<string, (typeof translations)[0][]>
    >((acc, trans) => {
      if (!acc[trans.asset_id]) {
        acc[trans.asset_id] = [];
      }
      acc[trans.asset_id]!.push(trans);
      return acc;
    }, {});

    // Group votes by translation
    const votesByTranslation = votes.reduce<
      Record<
        string,
        { id: string; polarity: 'up' | 'down'; creator_id: string }[]
      >
    >((acc, v) => {
      if (!acc[v.translation_id]) {
        acc[v.translation_id] = [];
      }
      acc[v.translation_id]!.push({
        id: v.id,
        polarity: v.polarity,
        creator_id: v.creator_id
      });
      return acc;
    }, {});

    // Build the data structure expected by calculateQuestProgress
    const assetsWithRelations = assets.map((assetData) => {
      const assetTranslations = translationsByAsset[assetData.id] || [];

      const translationsWithVotes = assetTranslations.map((trans) => ({
        id: trans.id,
        text: trans.text,
        creator_id: trans.creator_id,
        votes: votesByTranslation[trans.id] || []
      }));

      return {
        id: assetData.id,
        name: assetData.name,
        translations: translationsWithVotes
      };
    });

    return calculateQuestProgress(assetsWithRelations, currentUser?.id ?? null);
  }, [assets, translations, votes, assetIds, currentUser?.id]);

  const isLoading =
    isLoadingAssets ||
    isLoadingAssetDetails ||
    isLoadingTranslations ||
    isLoadingVotes;

  return {
    progress,
    isLoading
  };
};
