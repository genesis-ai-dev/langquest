import type { HybridDataSource } from '@/views/new/useHybridData';

export function isUnpublishedSource(
  source?: HybridDataSource | string | null
): boolean {
  // Mask local and any unknown/missing source — only explicitly published sources are safe.
  return source !== 'synced' && source !== 'cloud';
}
