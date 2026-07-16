/**
 * Helpers for quest_asset_link provenance metadata.
 */

export function isImportedAsset(metadata: unknown): boolean {
  let parsed = metadata;
  if (typeof metadata === 'string') {
    try {
      parsed = JSON.parse(metadata) as unknown;
    } catch {
      return false;
    }
  }
  if (!parsed || typeof parsed !== 'object') return false;
  return (
    (parsed as { provenance?: { type?: string } }).provenance?.type ===
    'imported'
  );
}
