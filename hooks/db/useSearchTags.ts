import type { Tag } from '@/database_services/tagService';
import { tagService } from '@/database_services/tagService';
import { useQuery } from '@tanstack/react-query';

// Re-export Tag type for convenience
export type { Tag };

/**
 * Returns { tags, isLoading, error }
 * Searches tags by key with optional limit
 */
export function useSearchTags({
  searchTerm,
  maxResults = 20,
  enabled = true
}: {
  searchTerm?: string;
  maxResults?: number;
  enabled?: boolean;
}) {
  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useQuery({
    queryKey: ['tags', 'search', searchTerm, maxResults],
    queryFn: () => tagService.searchTags(searchTerm, maxResults),
    enabled
  });

  return { tags, isTagsLoading, ...rest };
}
