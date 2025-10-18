/**
 * Utilities for asset naming
 */

/**
 * Generate a zero-padded asset name (e.g., "001", "002", "999")
 * Pads up to 3 digits by default
 */
export function generateAssetName(index: number, padding: number = 3): string {
  return index.toString().padStart(padding, '0');
}

/**
 * Get next available asset name based on existing assets
 * Finds the highest numeric name and increments it
 */
export function getNextAssetName(
  existingAssets: Array<{ name: string }>,
  padding: number = 3
): string {
  // Find all numeric names
  const numericNames = existingAssets
    .map((asset) => {
      const num = parseInt(asset.name, 10);
      return isNaN(num) ? 0 : num;
    })
    .filter((num) => num > 0);

  // Get the next number
  const nextNum = numericNames.length > 0 ? Math.max(...numericNames) + 1 : 1;

  return generateAssetName(nextNum, padding);
}
