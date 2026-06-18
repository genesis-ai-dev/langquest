import type { HybridDataSource } from '@/views/new/useHybridData';

export function isUnpublishedSource(
  source?: HybridDataSource | string | null
): boolean {
  return source === 'local';
}
