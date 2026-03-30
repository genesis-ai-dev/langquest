import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestById } from '@/hooks/db/useQuests';
import type { QuestMetadata } from '@/db/drizzleSchemaColumns';
import { useFiaBooks } from '@/hooks/useFiaBooks';
import { useProjectSourceLanguoid } from '@/hooks/useProjectSourceLanguoid';
import BibleAssetsView from '@/views/new/BibleAssetsView';
import { BibleChapterList } from '@/views/new/BibleChapterList';
import { FiaPericopeList } from '@/views/new/FiaPericopeList';
import NextGenAssetsView from '@/views/new/NextGenAssetsView';
import { useGlobalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

function parseQuestMetadata(raw: unknown): QuestMetadata | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return (typeof parsed === 'string' ? JSON.parse(parsed) : parsed) as QuestMetadata;
  } catch {
    return null;
  }
}

function FiaBookRoute({ projectId, bookId }: { projectId: string; bookId: string }) {
  const { sourceLanguoidId, isLoading: isLanguoidLoading } =
    useProjectSourceLanguoid(projectId);
  const { books, isLoading: isBooksLoading } = useFiaBooks(sourceLanguoidId);

  const book = useMemo(
    () => books.find((b) => b.id === bookId),
    [books, bookId]
  );

  if (isLanguoidLoading || isBooksLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!book) {
    return <BibleAssetsView />;
  }

  return <FiaPericopeList projectId={projectId} book={book} />;
}

export default function QuestRoute() {
  const { projectId, questId } = useGlobalSearchParams<{
    projectId: string;
    questId: string;
  }>();
  const { project } = useProjectById(projectId);
  const { quest, isQuestLoading } = useQuestById(questId);

  const resolvedTemplate = project?.template;
  const lockedTemplateRef = useRef(resolvedTemplate);
  if (resolvedTemplate) {
    lockedTemplateRef.current = resolvedTemplate;
  }

  const template = lockedTemplateRef.current;

  const metadata = useMemo(() => parseQuestMetadata(quest?.metadata), [quest?.metadata]);

  const isBookQuest = useMemo(() => {
    if (template === 'bible') {
      return !!metadata?.bible?.book && metadata.bible.chapter === undefined;
    }
    if (template === 'fia') {
      return !!metadata?.fia?.bookId && !metadata.fia.pericopeId;
    }
    return false;
  }, [template, metadata]);

  const bookId = metadata?.bible?.book ?? metadata?.fia?.bookId;

  if (template === 'bible' || template === 'fia') {
    if (isQuestLoading && !quest) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }

    if (isBookQuest && bookId && projectId) {
      if (template === 'fia') {
        return <FiaBookRoute projectId={projectId} bookId={bookId} />;
      }
      return <BibleChapterList projectId={projectId} bookId={bookId} />;
    }

    return <BibleAssetsView />;
  }

  return <NextGenAssetsView />;
}
