import ReviewsView from '@/views/new/ReviewsView';
import { useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReviewsRoute() {
  const { subjectName, parentQuestId, projectId, questId } =
    useLocalSearchParams<{
      subjectName?: string;
      parentQuestId?: string;
      projectId?: string;
      questId?: string;
    }>();

  return (
    <ReviewsView
      subjectName={firstParam(subjectName)}
      parentQuestId={firstParam(parentQuestId)}
      projectId={firstParam(projectId)}
      questId={firstParam(questId)}
    />
  );
}
