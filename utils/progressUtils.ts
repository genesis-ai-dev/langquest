import { Vote } from '@/database_services/voteService';
import { Translation } from '@/database_services/translationService';
import { colors } from '@/styles/theme';

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

  // If translation has votes
  if (voteCount > 0) {
    return colors.success;
  }

  // If translation has more downvotes than upvotes, don't show gem
  return null;
};
