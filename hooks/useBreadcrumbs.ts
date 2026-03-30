/**
 * Breadcrumbs derived from the nested route hierarchy.
 * Walks the quest parent_id chain to build ancestor crumbs,
 * so breadcrumbs work for any nesting depth (bible books, chapters, flat quests, etc.)
 */

import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAssetById } from '@/hooks/db/useAssets';
import { useProjectById } from '@/hooks/db/useProjects';
import { useQuestById } from '@/hooks/db/useQuests';
import { useLocalization } from '@/hooks/useLocalization';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useEffect, useMemo, useState } from 'react';

function href(path: string): Href {
  return path as unknown as Href;
}

interface Breadcrumb {
  label: string;
  onPress?: () => void;
}

/**
 * Walk parent_id chain from a quest up to the project root.
 * Returns ancestors ordered root-first (e.g. [book, chapter-parent]).
 * Uses local PowerSync DB for instant lookups.
 */
function useQuestAncestors(questId: string | undefined) {
  const [ancestors, setAncestors] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!questId) {
      setAncestors([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function walkParents(id: string) {
      const chain: { id: string; name: string }[] = [];
      let currentId: string | null = id;

      while (currentId) {
        const results: { parentId: string | null; parentName: string | null }[] =
          await system.db
            .select({
              parentId: questTable.parent_id,
              parentName: questTable.name
            })
            .from(questTable)
            .where(eq(questTable.id, currentId))
            .limit(1);

        const row = results[0];
        if (!row?.parentId) break;

        const parentResults: { id: string; name: string | null }[] =
          await system.db
            .select({ id: questTable.id, name: questTable.name })
            .from(questTable)
            .where(eq(questTable.id, row.parentId))
            .limit(1);

        const parent = parentResults[0];
        if (!parent) break;

        chain.unshift({ id: parent.id, name: parent.name || 'Quest' });

        const grandparentResults: { parentId: string | null }[] =
          await system.db
            .select({ parentId: questTable.parent_id })
            .from(questTable)
            .where(eq(questTable.id, parent.id))
            .limit(1);

        currentId = grandparentResults[0]?.parentId ?? null;
      }

      if (!cancelled) {
        setAncestors(chain);
        setIsLoading(false);
      }
    }

    walkParents(questId);

    return () => {
      cancelled = true;
    };
  }, [questId]);

  return { ancestors, isLoading };
}

export function useBreadcrumbs(): Breadcrumb[] {
  const params = useGlobalSearchParams<{
    projectId?: string;
    questId?: string;
    assetId?: string;
  }>();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocalization();

  const projectId = (params.projectId as string) || undefined;
  const questId = (params.questId as string) || undefined;
  const assetId = (params.assetId as string) || undefined;

  const { project } = useProjectById(projectId);
  const { quest } = useQuestById(questId);
  const { asset } = useAssetById(assetId);
  const { ancestors } = useQuestAncestors(questId);

  const isOnRecording = pathname.endsWith('/recording');

  const standaloneRoute = pathname.endsWith('/settings')
    ? 'settings'
    : pathname.endsWith('/notifications')
      ? 'notifications'
      : pathname.endsWith('/profile')
        ? 'profile'
        : null;

  return useMemo(() => {
    const crumbs: Breadcrumb[] = [];

    const isDeeper = !!(projectId || questId || assetId || standaloneRoute);

    crumbs.push({
      label: t('projects'),
      onPress: isDeeper ? () => router.dismissTo(href('/(app)/')) : undefined
    });

    if (standaloneRoute) {
      crumbs.push({ label: t(standaloneRoute) });
      return crumbs;
    }

    if (project && projectId) {
      crumbs.push({
        label: project.name || 'Project',
        onPress:
          questId || assetId
            ? () =>
                router.dismissTo(
                  href(`/(app)/project/${projectId}`)
                )
            : undefined
      });
    }

    for (const ancestor of ancestors) {
      crumbs.push({
        label: ancestor.name,
        onPress: () =>
          router.dismissTo(
            href(`/(app)/project/${projectId}/quest/${ancestor.id}`)
          )
      });
    }

    if (quest && questId) {
      const isCurrentLevel = !assetId && !isOnRecording;
      crumbs.push({
        label: quest.name || 'Quest',
        onPress: isCurrentLevel
          ? undefined
          : () =>
              router.dismissTo(
                href(`/(app)/project/${projectId}/quest/${questId}`)
              )
      });
    }

    if (asset && assetId) {
      crumbs.push({ label: asset.name || 'Asset' });
    }

    if (isOnRecording) {
      crumbs.push({ label: t('recording') || 'Recording' });
    }

    return crumbs;
  }, [
    project,
    quest,
    asset,
    ancestors,
    projectId,
    questId,
    assetId,
    isOnRecording,
    standaloneRoute,
    router,
    t,
    pathname
  ]);
}
