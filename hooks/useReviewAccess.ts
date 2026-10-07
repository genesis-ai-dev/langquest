import { useAuth } from '@/contexts/AuthContext';
import { useUserMemberships } from '@/hooks/db/useProfiles';

/** The review creator and project owners can manage a review and still see it while inactive. */
export function useReviewAccess() {
  const { currentUser } = useAuth();
  const { getUserMembership } = useUserMemberships();
  const userId = currentUser?.id ?? null;

  const isProjectOwner = (projectId: string | null | undefined) =>
    !!projectId && getUserMembership(projectId)?.membership === 'owner';

  const canManageReview = (review: {
    projectId: string | null | undefined;
    profileId: string | null | undefined;
  }) =>
    isProjectOwner(review.projectId) ||
    (!!userId && review.profileId === userId);

  return { userId, isProjectOwner, canManageReview };
}
