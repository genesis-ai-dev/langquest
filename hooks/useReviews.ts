import type { ReviewOutcome, ReviewStatus } from '@/components/ReviewCard';

export type ReviewTab = 'in-progress' | 'completed';

type ReviewBase = {
  id: string;
  title: string;
  creatorName: string;
  date: string;
  origin: string;
};

export type Review = ReviewBase &
  (
    | { status: Extract<ReviewStatus, 'draft'> }
    | {
        status: Extract<ReviewStatus, 'published'>;
        outcome: ReviewOutcome;
      }
  );

const DRAFT_REVIEWS: Review[] = [
  {
    id: 'review-draft-1',
    title: 'Opening pronunciation',
    creatorName: 'Maria Santos',
    date: '2026-09-28 10:15:00',
    origin: 'Genesis 1',
    status: 'draft'
  },
  {
    id: 'review-draft-2',
    title: 'Shared with reviewer',
    creatorName: 'John Carter',
    date: '2026-09-25 16:40:00',
    origin: 'Genesis 2',
    status: 'draft'
  }
];

const COMPLETED_REVIEWS: Review[] = [
  {
    id: 'review-completed-1',
    title: 'Verse 3 wording',
    creatorName: 'Ana Ribeiro',
    date: '2026-09-12 09:00:00',
    origin: 'Genesis 1',
    status: 'published',
    outcome: 'approved'
  },
  {
    id: 'review-completed-2',
    title: 'Chapter flow',
    creatorName: 'David Okonkwo',
    date: '2026-08-20 13:20:00',
    origin: 'Genesis 3',
    status: 'published',
    outcome: 'suggested-changes'
  }
];

export function useReviews(tab: ReviewTab) {
  const reviews = tab === 'in-progress' ? DRAFT_REVIEWS : COMPLETED_REVIEWS;

  return { reviews };
}
