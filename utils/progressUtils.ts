import { Vote } from '@/database_services/voteService';
import { Translation } from '@/database_services/translationService';
import { colors } from '@/styles/theme';
import { Asset } from '@/database_services/assetService';
import { Quest } from '@/database_services/questService';

/**
 * Calculates the net vote count from an array of votes
 * @param votes Array of votes
 * @returns Net vote count (upvotes - downvotes)
 */
export const calculateVoteCount = (votes: Vote[]): number => {
  return votes.reduce(
    (acc, vote) => acc + (vote.polarity === 'up' ? 1 : -1),
    0
  );
};

/**
 * Determines if a translation should be counted based on its votes
 * @param votes Array of votes for the translation
 * @returns boolean indicating if the translation should be counted
 */
export const shouldCountTranslation = (votes: Vote[]): boolean => {
  const voteCount = calculateVoteCount(votes);
  // Only count translations that have no votes or a positive vote count
  return votes.length === 0 || voteCount > 0;
};

/**
 * Determines the color of a gem based on votes and translation ownership
 * @param translation The translation to evaluate
 * @param votes Array of votes for the translation
 * @param currentUserId ID of the current user
 * @returns Color string or null if gem should not be shown
 */
export const getGemColor = (
  translation: Translation,
  votes: Vote[],
  currentUserId: string | null
): string | null => {
  if (!shouldCountTranslation(votes)) {
    return null;
  }

  const voteCount = calculateVoteCount(votes);

  // If translation has no votes
  if (votes.length === 0) {
    // If translation was made by current user
    if (currentUserId && currentUserId === translation.creator_id) {
      return colors.textSecondary;
    }
    // If translation was made by another user
    return colors.alert;
  }

  // If translation has votes and wasn't excluded by shouldCountTranslation
  return colors.success;
};

/**
 * Calculates the progress statistics for a quest's assets and their translations
 */
export interface QuestProgress {
  approvedPercentage: number; // Percentage of assets with approved translations
  userContributedPercentage: number; // Percentage of assets with user's pending translations
  pendingTranslationsCount: number; // Number of translations by others pending review
  totalAssets: number; // Total number of assets in the quest
  approvedAssets: number; // Number of assets with approved translations
  userContributedAssets: number; // Number of assets with user's pending translations
}

/**
 * Calculates progress statistics for a quest based on its assets and translations
 */
export const calculateQuestProgress = (
  assets: Asset[],
  translations: Record<string, Translation[]>,
  votes: Record<string, Vote[]>,
  currentUserId: string | null
): QuestProgress => {
  let approvedCount = 0;
  let userContributedCount = 0;
  let pendingCount = 0;

  assets.forEach((asset) => {
    const assetTranslations = translations[asset.id] || [];
    let hasApprovedTranslation = false;
    let hasUserContribution = false;

    assetTranslations.forEach((translation) => {
      const translationVotes = votes[translation.id] || [];

      // Skip translations that shouldn't be counted
      if (!shouldCountTranslation(translationVotes)) {
        return;
      }

      const voteCount = calculateVoteCount(translationVotes);

      // Check if this translation is approved (more upvotes than downvotes)
      if (voteCount > 0) {
        hasApprovedTranslation = true;
      }
      // Check if this is user's translation with no votes
      else if (
        currentUserId &&
        translation.creator_id === currentUserId &&
        translationVotes.length === 0
      ) {
        hasUserContribution = true;
      }
      // Check if this is another user's translation pending review
      else if (
        currentUserId &&
        translation.creator_id !== currentUserId &&
        translationVotes.length === 0
      ) {
        pendingCount++;
      }
    });

    if (hasApprovedTranslation) {
      approvedCount++;
    } else if (hasUserContribution) {
      userContributedCount++;
    }
  });

  return {
    approvedPercentage: (approvedCount / assets.length) * 100,
    userContributedPercentage: (userContributedCount / assets.length) * 100,
    pendingTranslationsCount: pendingCount,
    totalAssets: assets.length,
    approvedAssets: approvedCount,
    userContributedAssets: userContributedCount
  };
};

/**
 * Calculates the aggregated progress for a project by combining all quest progress
 */
export interface ProjectProgress {
  approvedPercentage: number;
  userContributedPercentage: number;
  pendingTranslationsCount: number;
  totalAssets: number;
}

/**
 * Aggregates progress statistics from multiple quests into project-level progress
 */
export const calculateProjectProgress = (
  questProgresses: QuestProgress[]
): ProjectProgress => {
  const totalProgress = questProgresses.reduce(
    (acc, quest) => {
      acc.totalAssets += quest.totalAssets;
      acc.approvedAssets += quest.approvedAssets;
      acc.userContributedAssets += quest.userContributedAssets;
      acc.pendingTranslationsCount += quest.pendingTranslationsCount;
      return acc;
    },
    {
      totalAssets: 0,
      approvedAssets: 0,
      userContributedAssets: 0,
      pendingTranslationsCount: 0
    }
  );

  return {
    approvedPercentage:
      totalProgress.totalAssets > 0
        ? (totalProgress.approvedAssets / totalProgress.totalAssets) * 100
        : 0,
    userContributedPercentage:
      totalProgress.totalAssets > 0
        ? (totalProgress.userContributedAssets / totalProgress.totalAssets) *
          100
        : 0,
    pendingTranslationsCount: totalProgress.pendingTranslationsCount,
    totalAssets: totalProgress.totalAssets
  };
};
