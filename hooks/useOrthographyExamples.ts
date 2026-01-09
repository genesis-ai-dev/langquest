import { asset, asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { eq, and, isNotNull } from 'drizzle-orm';
import { useQuery } from '@tanstack/react-query';

const MAX_EXAMPLES = 30;

/**
 * Fetches text examples in a specific language from a project.
 * Used for providing orthography context to the transcription localization AI.
 *
 * Returns up to 30 text samples showing how the language is correctly written.
 */
export function useOrthographyExamples(
  projectId: string | null | undefined,
  languageId: string | null | undefined
) {
  return useQuery<string[]>({
    queryKey: ['orthography-examples', projectId, languageId],
    queryFn: async () => {
      if (!projectId || !languageId) {
        return [];
      }

      try {
        // Get text samples from asset_content_link entries in this language within the project
        const results = await system.db
          .select({
            text: asset_content_link.text
          })
          .from(asset_content_link)
          .innerJoin(asset, eq(asset.id, asset_content_link.asset_id))
          .where(
            and(
              eq(asset.project_id, projectId),
              eq(asset_content_link.languoid_id, languageId),
              eq(asset.active, true),
              eq(asset_content_link.active, true),
              isNotNull(asset_content_link.text)
            )
          )
          .limit(MAX_EXAMPLES);

        // Filter out empty/whitespace-only text and extract strings
        const examples = results
          .map((r) => r.text?.trim())
          .filter((text): text is string => !!text && text.length > 0);

        if (__DEV__) {
          console.log(
            `[useOrthographyExamples] Found ${examples.length} examples for language ${languageId} in project ${projectId}`
          );
        }

        return examples;
      } catch (error) {
        console.error(
          '[useOrthographyExamples] Error fetching examples:',
          error
        );
        return [];
      }
    },
    enabled:
      !!projectId && !!languageId && projectId !== '' && languageId !== '',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000 // Keep in cache for 10 minutes
  });
}
