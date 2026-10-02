import ReviewEditView from '@/views/new/ReviewEditView';
import { useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReviewEditRoute() {
  const { projectId, questId, reviewId, subjectName } = useLocalSearchParams<{
    projectId: string;
    questId: string;
    reviewId?: string;
    subjectName?: string;
  }>();

  const project = firstParam(projectId);
  const quest = firstParam(questId);
  if (!project || !quest) return null;

  return (
    <ReviewEditView
      projectId={project}
      questId={quest}
      reviewId={firstParam(reviewId)}
      subjectName={firstParam(subjectName)}
    />
  );
}
