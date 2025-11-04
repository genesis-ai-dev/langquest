/**
 * Utility functions for sorting items (assets, quests, etc.) with advanced logic
 */

/**
 * Extracts numeric references from text, handling chapter:verse format
 * @param text The text to extract numeric references from
 * @returns Array of numbers representing the reference, or null if none found
 */
export const extractNumericReferences = (text: string): number[] | null => {
  // Skip empty text
  if (!text) return null;

  // First split by whitespace to get tokens
  const tokens = text.split(/\s+/);

  // Look for tokens that might contain numeric references (with : or .)
  for (const token of tokens) {
    // Remove any parentheses and their contents
    const cleanToken = token.replace(/\([^)]*\)/g, '').trim();

    if (cleanToken.includes(':') || cleanToken.includes('.')) {
      const separator = cleanToken.includes(':') ? ':' : '.';
      const parts = cleanToken.split(separator).map((part) => {
        // Try to parse as integer, handling non-numeric characters
        const num = parseInt(part.replace(/\D/g, ''), 10);
        return isNaN(num) ? null : num;
      });

      // Make sure all parts are valid numbers
      if (parts.length > 1 && parts[0] !== null && parts[1] !== null) {
        return parts.filter((part): part is number => part !== null);
      }
    }
  }

  // If no valid reference found, look for any numeric token
  for (const token of tokens) {
    // Skip tokens that are likely part of parenthetical content
    if (token.startsWith('(') || token.endsWith(')')) continue;

    const num = parseInt(token.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      return [num];
    }
  }

  return null; // No numeric reference found
};

/**
 * Compare two strings based on numeric references they might contain
 */
export const compareByNumericReference = (a: string, b: string): number => {
  const refsA = extractNumericReferences(a);
  const refsB = extractNumericReferences(b);

  // If both have numeric references, compare them
  if (refsA && refsB) {
    // Compare first parts (chapters)
    if (refsA[0] !== refsB[0]) {
      return refsA[0]! - refsB[0]!;
    }

    // If first parts are the same and there are second parts, compare them (verses)
    if (refsA.length > 1 && refsB.length > 1) {
      return refsA[1]! - refsB[1]!;
    }
  }

  // If one has numeric references and the other doesn't, prioritize the one with references
  if (refsA && !refsB) return -1;
  if (!refsA && refsB) return 1;

  // Default to standard string comparison
  return a.localeCompare(b);
};

/**
 * Generic sorting function that can be used for both assets and quests
 * with intelligent handling of numeric references
 */
export function sortItems<T extends { id: string; name: string }>(
  items: T[],
  sorting: { field: string; order: 'asc' | 'desc' }[],
  getTags: (itemId: string) => { name: string }[]
): T[] {
  // If no sorting options are provided, apply default sorting by name with numeric reference awareness
  if (sorting.length === 0) {
    return [...items].sort((a, b) => {
      return compareByNumericReference(a.name, b.name);
    });
  }

  // Apply custom sorting options
  return [...items].sort((a, b) => {
    for (const { field, order } of sorting) {
      if (field === 'name') {
        // For name sorting, use our compareByNumericReference function
        const comparison = compareByNumericReference(a.name, b.name);
        return order === 'asc' ? comparison : -comparison;
      } else {
        // For tag-based sorting
        const tagsA = getTags(a.id);
        const tagsB = getTags(b.id);

        const tagValueA =
          tagsA
            .find((tag) => tag.name.startsWith(`${field}:`))
            ?.name.split(':')[1] ?? '';
        const tagValueB =
          tagsB
            .find((tag) => tag.name.startsWith(`${field}:`))
            ?.name.split(':')[1] ?? '';

        // Use numeric reference comparison for tag values too
        const comparison = compareByNumericReference(tagValueA, tagValueB);

        if (comparison !== 0) {
          return order === 'asc' ? comparison : -comparison;
        }
      }
    }
    return 0;
  });
}
