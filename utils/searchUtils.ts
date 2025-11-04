/**
 * Simple relevance scoring for search results.
 * Scores options based on how well they match the search query.
 *
 * Scoring rules (higher is better):
 * - Exact match at start of label: 100 points
 * - Match at start of word in label: 80 points
 * - Match anywhere in label: 40 points
 * - Match at start of searchTerms: 60 points
 * - Match anywhere in searchTerms: 20 points
 * - Exact case match bonus: +10 points
 */

export interface ScoredOption<T> {
  option: T;
  score: number;
}

export interface SearchableOption {
  label: string;
  searchTerms?: string;
}

/**
 * Calculate relevance score for a single option
 */
function calculateScore(option: SearchableOption, searchLower: string): number {
  let score = 0;
  const labelLower = option.label.toLowerCase();
  const searchTermsLower = option.searchTerms?.toLowerCase() ?? '';

  // Exact case match bonus
  if (option.label.toLowerCase() === searchLower) {
    score += 10;
  }

  // Label matching
  if (labelLower.startsWith(searchLower)) {
    // Match at start of label is most relevant
    score += 100;
  } else if (labelLower.includes(` ${searchLower}`)) {
    // Match at start of a word in label
    score += 80;
  } else if (labelLower.includes(searchLower)) {
    // Match anywhere in label
    score += 40;
  }

  // SearchTerms matching (only if not already found in label)
  if (score === 0 || score < 100) {
    if (searchTermsLower.startsWith(searchLower)) {
      score += 60;
    } else if (searchTermsLower.includes(searchLower)) {
      score += 20;
    }
  }

  // Boost score if the match is early in the string
  const labelIndex = labelLower.indexOf(searchLower);
  if (labelIndex >= 0 && labelIndex < 10) {
    score += 5;
  }

  return score;
}

/**
 * Filter and score search options based on relevance
 */
export function scoreSearchResults<T extends SearchableOption>(
  options: T[],
  searchQuery: string
): ScoredOption<T>[] {
  const searchTrimmed = searchQuery.trim();
  if (!searchTrimmed) {
    return [];
  }

  const searchLower = searchTrimmed.toLowerCase();
  const scored: ScoredOption<T>[] = [];

  for (const option of options) {
    const score = calculateScore(option, searchLower);
    if (score > 0) {
      scored.push({ option, score });
    }
  }

  // Sort by score (descending), then by label alphabetically for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.option.label.localeCompare(b.option.label);
  });

  return scored;
}
