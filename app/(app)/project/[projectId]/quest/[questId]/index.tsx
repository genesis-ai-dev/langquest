import { useProjectById } from '@/hooks/db/useProjects';
import BibleAssetsView from '@/views/new/BibleAssetsView';
import NextGenAssetsView from '@/views/new/NextGenAssetsView';
import { useGlobalSearchParams } from 'expo-router';

export default function QuestRoute() {
  const { projectId } = useGlobalSearchParams<{ projectId: string }>();
  const { project } = useProjectById(projectId);
  const isBibleLike =
    project?.template === 'bible' || project?.template === 'fia';

  if (isBibleLike) {
    return <BibleAssetsView />;
  }
  return <NextGenAssetsView />;
}
