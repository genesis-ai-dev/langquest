import type { Translation } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import { colors } from '@/styles/theme';
/**
 * Calculates the net vote count from an array of votes
 * @param votes Array of votes
 * @returns Net vote count (upvotes - downvotes)
 */
export const calculateVoteCount = (
  votes: Vote[] | VoteWithRelations[]
): number => {
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
export const shouldCountTranslation = (
  votes: Vote[] | VoteWithRelations[]
): boolean => {
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
): string => {
  let gemColor: string = colors.success;

  if (!shouldCountTranslation(votes)) {
    return colors.downVoted;
  }
  // If translation has no votes
  if (votes.length === 0) {
    // If translation was made by current user
    if (currentUserId && currentUserId === translation.creator_id) {
      gemColor = colors.textSecondary;
    } else {
      // If translation was made by another user
      gemColor = colors.alert;
    }
  }
  // If translation has votes, gemColor remains colors.success

  return gemColor;
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

interface AssetWithRelations {
  id: string;
  name: string;
  translations: TranslationWithRelations[];
}

interface TranslationWithRelations {
  id: string;
  text: string | null;
  creator_id: string;
  votes: {
    id: string;
    polarity: 'up' | 'down';
    creator_id: string;
  }[];
}

interface VoteWithRelations {
  id: string;
  polarity: 'up' | 'down';
  creator_id: string;
}

export const calculateQuestProgress = (
  assets: AssetWithRelations[],
  currentUserId: string | null
): QuestProgress => {
  let approvedCount = 0;
  let userContributedCount = 0;
  let pendingCount = 0;

  assets.forEach((asset) => {
    const assetTranslations = asset.translations;
    let hasApprovedTranslation = false;
    let hasUserContribution = false;

    // First pass: Check for approved translations
    for (const translation of assetTranslations) {
      const translationVotes = translation.votes;
      if (
        translation.votes.length === 0 &&
        translation.creator_id !== currentUserId
      ) {
        pendingCount++;
        continue;
      }
      if (!shouldCountTranslation(translationVotes)) continue;

      const upVoteCount = calculateVoteCount(translationVotes);
      if (upVoteCount > 0) {
        hasApprovedTranslation = true;
        continue;
      }
    }

    // Second pass: Only check for user contributions and pending translations if no approved translation exists
    if (!hasApprovedTranslation) {
      for (const translation of assetTranslations) {
        const translationVotes = translation.votes;
        if (!shouldCountTranslation(translationVotes)) continue;

        const upVoteCount = calculateVoteCount(translationVotes);

        if (
          currentUserId &&
          translation.creator_id === currentUserId &&
          upVoteCount === 0
        ) {
          hasUserContribution = true;
          break;
        }
      }
    }

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
  const totalProgress = {
    totalAssets: 0,
    approvedAssets: 0,
    userContributedAssets: 0,
    pendingTranslationsCount: 0
  };
  // questProgresses.reduce(
  //   (acc, quest) => {
  //     acc.totalAssets += quest.totalAssets;
  //     acc.approvedAssets += quest.approvedAssets;
  //     acc.userContributedAssets += quest.userContributedAssets;
  //     acc.pendingTranslationsCount += quest.pendingTranslationsCount;
  //     return acc;
  //   },
  //   {
  //     totalAssets: 0,
  //     approvedAssets: 0,
  //     userContributedAssets: 0,
  //     pendingTranslationsCount: 0
  //   }
  // );

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
