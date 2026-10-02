import ReviewResultView from '@/views/new/ReviewResultView';
import { useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReviewResultRoute() {
  const { questId, reviewId, subjectName } = useLocalSearchParams<{
    questId: string;
    reviewId: string;
    subjectName?: string;
  }>();

  const quest = firstParam(questId);
  const review = firstParam(reviewId);
  if (!quest || !review) return null;

  return (
    <ReviewResultView
      questId={quest}
      reviewId={review}
      subjectName={firstParam(subjectName)}
    />
  );
}
