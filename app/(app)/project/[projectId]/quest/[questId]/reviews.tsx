import ReviewListView from '@/views/new/ReviewListView';
import { useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMetadata(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export default function ReviewsRoute() {
  const { subjectName, parentQuestId, projectId, questId, metadata } =
    useLocalSearchParams<{
      subjectName?: string;
      parentQuestId?: string;
      projectId?: string;
      questId?: string;
      metadata?: string;
    }>();

  return (
    <ReviewListView
      subjectName={firstParam(subjectName)}
      parentQuestId={firstParam(parentQuestId)}
      projectId={firstParam(projectId)}
      questId={firstParam(questId)}
      metadata={parseMetadata(firstParam(metadata))}
    />
  );
}
