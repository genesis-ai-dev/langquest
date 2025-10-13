/**
 * React hook for publishing Bible chapters
 * Provides UI-friendly interface to the publishing service
 */

import { useAuth } from '@/contexts/AuthContext';
import type { PublishChapterResult } from '@/database_services/publishService';
import { publishBibleChapter } from '@/database_services/publishService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UseChapterPublishingResult {
    publishChapter: (chapterId: string) => Promise<PublishChapterResult>;
    isPublishing: boolean;
    publishResult: PublishChapterResult | null;
    error: Error | null;
}

/**
 * Hook for publishing Bible chapters
 * 
 * Usage:
 * ```tsx
 * const { publishChapter, isPublishing } = useChapterPublishing();
 * 
 * const handlePublish = async () => {
 *   const result = await publishChapter(chapterId);
 *   if (result.success) {
 *     Alert.alert('Success', result.message);
 *   } else {
 *     Alert.alert('Error', result.errors.join('\n'));
 *   }
 * };
 * ```
 */
export function useChapterPublishing(t: (key: string) => string): UseChapterPublishingResult {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const {
        mutateAsync: publishChapter,
        isPending: isPublishing,
        data: publishResult,
        error
    } = useMutation({
        mutationFn: async (chapterId: string) => {
            if (!currentUser?.id) {
                throw new Error('User not authenticated');
            }

            console.log(`🚀 Publishing chapter: ${chapterId}`);

            const result = await publishBibleChapter({
                chapterId,
                userId: currentUser.id,
                t
            });

            if (!result.success) {
                throw new Error(result.errors?.join(', ') || 'Publishing failed');
            }

            return result;
        },
        onSuccess: (result) => {
            console.log('✅ Chapter publish queued successfully');

            // Invalidate queries to refresh UI
            // The chapter list should now show it as "synced" instead of "local"
            void queryClient.invalidateQueries({
                queryKey: ['bible-chapters'],
                exact: false
            });

            // Invalidate assets query for this quest
            if (result.publishedQuestId) {
                void queryClient.invalidateQueries({
                    queryKey: ['assets', 'infinite', result.publishedQuestId],
                    exact: false
                });

                // CRITICAL: Invalidate quest publish status to update UI buttons
                void queryClient.invalidateQueries({
                    queryKey: ['quest-publish-status', result.publishedQuestId],
                    exact: false
                });
            }

            // Invalidate quest queries
            void queryClient.invalidateQueries({
                queryKey: ['quests'],
                exact: false
            });
        },
        onError: (error) => {
            console.error('❌ Chapter publish failed:', error);
        }
    });

    return {
        publishChapter,
        isPublishing,
        publishResult: publishResult || null,
        error: error
    };
}

