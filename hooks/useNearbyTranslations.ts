import {
  asset,
  asset_content_link,
  quest_asset_link,
  quest,
  vote
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { eq, and, isNotNull, isNull, inArray, sql, ne } from 'drizzle-orm';
import { useQuery } from '@tanstack/react-query';

export interface TranslationExample {
  source: string;
  target: string;
}

/**
 * Fetches nearby translations from the same quest/chapter, and expands to other quests in the same project if needed
 * Returns source→target pairs for use as examples in AI translation prediction
 *
 * Priority:
 * 1. First, get examples from the current quest
 * 2. If more examples are needed, get examples from other quests in the same project
 *
 * For each source asset, only the highest-rated translation (by upvotes) is selected.
 * If multiple translations have the same vote count, the most recent one is selected.
 * Maximum of 30 examples are returned (hardcoded limit).
 */
const MAX_EXAMPLES = 30;

export function useNearbyTranslations(
  questId: string | null | undefined,
  targetLanguageId: string
) {
  return useQuery<TranslationExample[]>({
    queryKey: ['nearby-translations', questId, targetLanguageId],
    queryFn: async () => {
      if (!questId || !targetLanguageId) {
        return [];
      }

      try {
        // Step 0: Get the current quest's project_id to find nearby quests
        const currentQuest = await system.db
          .select({
            projectId: quest.project_id
          })
          .from(quest)
          .where(eq(quest.id, questId))
          .limit(1)
          .then((results) => results[0]);

        if (!currentQuest) {
          if (__DEV__) {
            console.warn('[useNearbyTranslations] Current quest not found');
          }
          return [];
        }

        // Step 1: Get all original assets in the current quest (exclude translations which have source_asset_id)
        const currentQuestAssets = await system.db
          .select({
            assetId: asset.id,
            assetContentId: asset_content_link.id,
            sourceText: asset_content_link.text
          })
          .from(quest_asset_link)
          .innerJoin(asset, eq(quest_asset_link.asset_id, asset.id))
          .leftJoin(
            asset_content_link,
            eq(asset_content_link.asset_id, asset.id)
          )
          .where(
            and(
              eq(quest_asset_link.quest_id, questId),
              isNull(asset.source_asset_id), // Only original assets, not translations
              eq(asset.active, true),
              isNotNull(asset_content_link.text) // Only assets with text content
            )
          )
          .limit(100);

        // Step 2: Get examples from current quest first
        const examples: TranslationExample[] = [];
        const sourceTextMap = new Map<string, string>();

        // Add current quest assets to the source text map
        currentQuestAssets.forEach((a) => {
          if (a.sourceText) {
            sourceTextMap.set(a.assetId, a.sourceText);
          }
        });

        const currentQuestAssetIds = currentQuestAssets.map((a) => a.assetId);

        if (currentQuestAssetIds.length > 0) {
          const currentQuestExamples = await getExamplesFromAssets(
            currentQuestAssetIds,
            targetLanguageId,
            sourceTextMap
          );
          examples.push(...currentQuestExamples);
        }

        if (__DEV__) {
          console.log(
            '[useNearbyTranslations] Current quest assets:',
            currentQuestAssets.length
          );
          console.log(
            '[useNearbyTranslations] Examples from current quest:',
            examples.length
          );
        }

        // Step 3: If we need more examples, get them from other quests in the same project
        if (examples.length < MAX_EXAMPLES) {
          // Get other quests in the same project (excluding current quest)
          const otherQuests = await system.db
            .select({
              id: quest.id
            })
            .from(quest)
            .where(
              and(
                eq(quest.project_id, currentQuest.projectId),
                ne(quest.id, questId), // Exclude current quest
                eq(quest.active, true)
              )
            )
            .limit(50); // Limit to avoid querying too many quests

          if (__DEV__) {
            console.log(
              '[useNearbyTranslations] Other quests in project:',
              otherQuests.length
            );
          }

          // Get assets from other quests
          const otherQuestIds = otherQuests.map((q) => q.id);
          if (otherQuestIds.length > 0) {
            const otherQuestAssets = await system.db
              .select({
                assetId: asset.id,
                assetContentId: asset_content_link.id,
                sourceText: asset_content_link.text
              })
              .from(quest_asset_link)
              .innerJoin(asset, eq(quest_asset_link.asset_id, asset.id))
              .leftJoin(
                asset_content_link,
                eq(asset_content_link.asset_id, asset.id)
              )
              .where(
                and(
                  inArray(quest_asset_link.quest_id, otherQuestIds),
                  isNull(asset.source_asset_id), // Only original assets, not translations
                  eq(asset.active, true),
                  isNotNull(asset_content_link.text) // Only assets with text content
                )
              )
              .limit(200); // Get more assets from other quests

            // Add other quest assets to the source text map
            otherQuestAssets.forEach((a) => {
              if (a.sourceText && !sourceTextMap.has(a.assetId)) {
                sourceTextMap.set(a.assetId, a.sourceText);
              }
            });

            const otherQuestAssetIds = otherQuestAssets.map((a) => a.assetId);

            if (otherQuestAssetIds.length > 0) {
              const otherQuestExamples = await getExamplesFromAssets(
                otherQuestAssetIds,
                targetLanguageId,
                sourceTextMap
              );

              // Add examples up to MAX_EXAMPLES
              for (const example of otherQuestExamples) {
                if (examples.length >= MAX_EXAMPLES) {
                  break;
                }
                examples.push(example);
              }
            }

            if (__DEV__) {
              console.log(
                '[useNearbyTranslations] Other quest assets:',
                otherQuestAssets.length
              );
              console.log(
                '[useNearbyTranslations] Total examples after other quests:',
                examples.length
              );
            }
          }
        }

        if (__DEV__) {
          console.log(
            '[useNearbyTranslations] Final examples count:',
            examples.length
          );
          if (examples.length === 0) {
            console.warn(
              '[useNearbyTranslations] No examples found. This might mean:'
            );
            console.warn(
              '  - No translations exist in the target language for assets in this quest or project'
            );
            console.warn(
              '  - The quest/project has no assets with text content'
            );
            console.warn('  - All translations are inactive or have no text');
          }
        }

        return examples;
      } catch (error) {
        console.error(
          '[useNearbyTranslations] Error fetching nearby translations:',
          error
        );
        return [];
      }
    },
    enabled:
      !!questId &&
      !!targetLanguageId &&
      questId !== '' &&
      targetLanguageId !== '',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000 // Keep in cache for 10 minutes
  });
}

/**
 * Helper function to get examples from a set of asset IDs
 * Returns the highest-rated translation for each source asset
 */
async function getExamplesFromAssets(
  assetIds: string[],
  targetLanguageId: string,
  sourceTextMap: Map<string, string>
): Promise<TranslationExample[]> {
  if (assetIds.length === 0) {
    return [];
  }

  // Get all translations with their upvote counts
  const translationsWithVotes = await system.db
    .select({
      translationAssetId: asset.id,
      sourceAssetId: asset.source_asset_id,
      translationText: asset_content_link.text,
      upvoteCount: sql<number>`COALESCE(
        SUM(
          CASE
            WHEN ${vote.polarity} = 'up' AND ${vote.active} = 1 THEN 1
            ELSE 0
          END
        ),
        0
      )`.as('upvote_count'),
      createdAt: asset.created_at
    })
    .from(asset)
    .innerJoin(asset_content_link, eq(asset_content_link.asset_id, asset.id))
    .leftJoin(vote, eq(vote.asset_id, asset.id))
    .where(
      and(
        isNotNull(asset.source_asset_id),
        inArray(asset.source_asset_id, assetIds), // Only translations of these assets
        eq(asset.source_language_id, targetLanguageId), // Filter by target language
        eq(asset.active, true),
        isNotNull(asset_content_link.text)
      )
    )
    .groupBy(
      asset.id,
      asset.source_asset_id,
      asset_content_link.id,
      asset_content_link.text,
      asset.created_at
    )
    .all();

  // For each source asset, select only the highest-rated translation
  // If tied, select the most recent one
  const bestTranslationBySource = new Map<
    string,
    (typeof translationsWithVotes)[0]
  >();

  for (const translation of translationsWithVotes) {
    if (!translation.sourceAssetId || !translation.translationText) {
      continue;
    }

    const existing = bestTranslationBySource.get(translation.sourceAssetId);

    if (!existing) {
      // No translation selected yet for this source asset
      bestTranslationBySource.set(translation.sourceAssetId, translation);
    } else {
      // Compare: higher upvote count wins, or if tied, most recent wins
      const existingUpvotes = Number(existing.upvoteCount) || 0;
      const currentUpvotes = Number(translation.upvoteCount) || 0;

      if (currentUpvotes > existingUpvotes) {
        // Current translation has more upvotes
        bestTranslationBySource.set(translation.sourceAssetId, translation);
      } else if (currentUpvotes === existingUpvotes) {
        // Tie: use most recent
        const existingDate = existing.createdAt
          ? new Date(existing.createdAt)
          : new Date(0);
        const currentDate = translation.createdAt
          ? new Date(translation.createdAt)
          : new Date(0);

        if (currentDate > existingDate) {
          bestTranslationBySource.set(translation.sourceAssetId, translation);
        }
      }
    }
  }

  // Build examples from the best translations
  const examples: TranslationExample[] = [];

  for (const [
    sourceAssetId,
    translation
  ] of bestTranslationBySource.entries()) {
    const sourceText = sourceTextMap.get(sourceAssetId);
    if (sourceText && sourceText.trim() && translation.translationText) {
      examples.push({
        source: sourceText.trim(),
        target: translation.translationText.trim()
      });
    }
  }

  return examples;
}
