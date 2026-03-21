/**
 * Hook to query existing chapter quests for a Bible book within a project.
 * Preserves ALL distinct quest versions per chapter (different creators or
 * multiple versions by the same creator). Respects quest visibility settings.
 */

import { useAuth } from '@/contexts/AuthContext';
import { profile, quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { eq, inArray } from 'drizzle-orm';
import React from 'react';
import { useNetworkStatus } from './useNetworkStatus';

export interface BibleChapterQuest {
  id: string;
  name: string;
  chapterNumber: number;
  source: HybridDataSource;
  hasLocalCopy: boolean;
  hasSyncedCopy: boolean;
  download_profiles?: string[] | null;
  creator_id: string | null;
  created_at: string;
  creatorName?: string;
  visible: boolean;
}

export interface BibleChapterGroup {
  chapterNumber: number;
  versions: BibleChapterQuest[];
  primary: BibleChapterQuest;
}

interface QuestWithMetadata {
  quest_id: string;
  quest_name: string;
  quest_source: HybridDataSource;
  quest_created_at: string;
  quest_download_profiles: string[] | null;
  quest_creator_id: string | null;
  quest_visible: boolean;
  chapter_number: number | null;
}

interface BibleMetadata {
  bible?: {
    book?: string;
    chapter?: number;
  };
}

function parseMetadata(raw: unknown): BibleMetadata | null {
  try {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string')
        return JSON.parse(parsed) as BibleMetadata;
      return parsed as BibleMetadata;
    }
    return raw as BibleMetadata;
  } catch {
    return null;
  }
}

async function fetchLocalChapters(
  projectId: string,
  bookId: string
): Promise<QuestWithMetadata[]> {
  const allQuests = await system.db.query.quest.findMany({
    where: eq(quest.project_id, projectId),
    columns: {
      id: true,
      name: true,
      source: true,
      created_at: true,
      download_profiles: true,
      metadata: true,
      creator_id: true,
      visible: true
    }
  });

  return allQuests
    .map((q) => {
      const meta = parseMetadata(q.metadata);
      if (meta?.bible?.book !== bookId || meta.bible.chapter == null)
        return null;

      let parsedProfiles: string[] | null = null;
      const dp = q.download_profiles;
      if (dp) {
        try {
          parsedProfiles =
            typeof dp === 'string'
              ? (JSON.parse(dp) as string[])
              : Array.isArray(dp)
                ? (dp as string[])
                : null;
        } catch {
          /* ignore */
        }
      }

      let createdAt: string;
      const ca = q.created_at;
      if (ca && typeof ca === 'object' && 'toISOString' in ca) {
        createdAt = (ca as Date).toISOString();
      } else if (typeof ca === 'string') {
        createdAt = ca;
      } else {
        createdAt = new Date().toISOString();
      }

      return {
        quest_id: q.id,
        quest_name: q.name,
        quest_source: q.source,
        quest_created_at: createdAt,
        quest_download_profiles: parsedProfiles,
        quest_creator_id: q.creator_id ?? null,
        quest_visible: q.visible ?? true,
        chapter_number: meta.bible.chapter!
      } satisfies QuestWithMetadata;
    })
    .filter((x): x is QuestWithMetadata => x !== null);
}

async function fetchCloudChapters(
  projectId: string,
  bookId: string
): Promise<QuestWithMetadata[]> {
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select(
        'id, name, created_at, download_profiles, metadata, creator_id, visible'
      )
      .eq('project_id', projectId)
      .not('metadata', 'is', null);

    if (error || !data) return [];

    const results: QuestWithMetadata[] = [];
    for (const row of data) {
      if (!row.metadata) continue;
      const meta = parseMetadata(row.metadata);
      if (meta?.bible?.book !== bookId || meta.bible.chapter == null) continue;

      results.push({
        quest_id: row.id,
        quest_name: row.name,
        quest_source: 'cloud' as HybridDataSource,
        quest_created_at: row.created_at ?? new Date().toISOString(),
        quest_download_profiles: row.download_profiles as string[] | null,
        quest_creator_id: (row.creator_id as string) ?? null,
        quest_visible: (row.visible as boolean) ?? true,
        chapter_number: meta.bible.chapter!
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchCreatorNames(
  creatorIds: string[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (creatorIds.length === 0) return nameMap;

  try {
    const profiles = await system.db.query.profile.findMany({
      where: inArray(profile.id, creatorIds),
      columns: { id: true, username: true, email: true }
    });
    for (const p of profiles) {
      nameMap.set(p.id, p.username || p.email || 'Unknown');
    }
  } catch {
    /* ignore — names are best-effort */
  }

  return nameMap;
}

const getSourcePriority = (source: HybridDataSource): number => {
  if (source === 'synced') return 3;
  if (source === 'local') return 2;
  return 1;
};

interface DeduplicatedVersion {
  id: string;
  name: string;
  chapterNumber: number;
  sources: Set<HybridDataSource>;
  download_profiles?: string[] | null;
  created_at: string;
  creator_id: string | null;
  visible: boolean;
}

/**
 * Groups quest results by chapter number, keeping all distinct quest IDs.
 * Same quest ID appearing from both local and cloud = one entry with merged sources.
 * Filters out invisible versions when showHiddenContent is false.
 */
function processChapterResults(
  questResults: QuestWithMetadata[],
  showHiddenContent: boolean,
  currentUserId: string | null
): BibleChapterGroup[] {
  if (questResults.length === 0) return [];

  const questMap = new Map<string, DeduplicatedVersion>();

  for (const q of questResults) {
    if (!q.chapter_number) continue;

    const normalizedId = normalizeUuid(q.quest_id);
    const existing = questMap.get(normalizedId);

    if (!existing) {
      questMap.set(normalizedId, {
        id: q.quest_id,
        name: q.quest_name,
        chapterNumber: q.chapter_number,
        sources: new Set([q.quest_source]),
        download_profiles: q.quest_download_profiles,
        created_at: q.quest_created_at,
        creator_id: q.quest_creator_id,
        visible: q.quest_visible
      });
    } else {
      existing.sources.add(q.quest_source);
      if (
        getSourcePriority(q.quest_source) >
        Math.max(...Array.from(existing.sources).map(getSourcePriority))
      ) {
        existing.download_profiles = q.quest_download_profiles;
      }
    }
  }

  const chapterGroups = new Map<number, DeduplicatedVersion[]>();

  for (const v of questMap.values()) {
    const group = chapterGroups.get(v.chapterNumber) ?? [];
    group.push(v);
    chapterGroups.set(v.chapterNumber, group);
  }

  return Array.from(chapterGroups.entries())
    .map(([chapterNumber, versions]) => {
      const mapped: BibleChapterQuest[] = versions
        .filter(
          (v) =>
            showHiddenContent || v.visible || v.creator_id === currentUserId
        )
        .map((v) => ({
          id: v.id,
          name: v.name,
          chapterNumber: v.chapterNumber,
          source: (v.sources.has('synced')
            ? 'synced'
            : v.sources.has('local')
              ? 'local'
              : 'cloud') as HybridDataSource,
          hasLocalCopy: v.sources.has('local'),
          hasSyncedCopy: v.sources.has('synced'),
          download_profiles: v.download_profiles,
          creator_id: v.creator_id,
          created_at: v.created_at,
          visible: v.visible
        }))
        .sort((a, b) => {
          const aPriority = getSourcePriority(a.source);
          const bPriority = getSourcePriority(b.source);
          if (aPriority !== bPriority) return bPriority - aPriority;
          return b.created_at.localeCompare(a.created_at);
        });

      if (mapped.length === 0) return null;

      return {
        chapterNumber,
        versions: mapped,
        primary: mapped[0]!
      };
    })
    .filter((g): g is BibleChapterGroup => g !== null)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
}

export function useBibleChapters(projectId: string, bookId: string) {
  const isOnline = useNetworkStatus();
  const showHiddenContent = useLocalStore((s) => s.showHiddenContent);
  const { currentUser } = useAuth();

  const {
    data: localResults = [],
    isLoading: isLoadingLocal,
    error: localError
  } = useQuery({
    queryKey: ['bible-chapters', 'local', projectId, bookId],
    queryFn: () => fetchLocalChapters(projectId, bookId),
    enabled: !!projectId && !!bookId,
    staleTime: 30000
  });

  const { data: cloudResults = [], isLoading: isLoadingCloud } = useQuery({
    queryKey: ['bible-chapters', 'cloud', projectId, bookId],
    queryFn: () => fetchCloudChapters(projectId, bookId),
    enabled: !!projectId && !!bookId && isOnline,
    staleTime: 60000
  });

  const chapterGroups = React.useMemo(() => {
    const allResults = [...localResults, ...cloudResults];
    return processChapterResults(
      allResults,
      showHiddenContent,
      currentUser?.id ?? null
    );
  }, [localResults, cloudResults, showHiddenContent, currentUser?.id]);

  const creatorIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const group of chapterGroups) {
      for (const v of group.versions) {
        if (v.creator_id) ids.add(v.creator_id);
      }
    }
    return Array.from(ids);
  }, [chapterGroups]);

  const { data: creatorNameMap } = useQuery({
    queryKey: ['profile-names', ...creatorIds.sort()],
    queryFn: () => fetchCreatorNames(creatorIds),
    enabled: creatorIds.length > 0,
    staleTime: 300000
  });

  const chapters = React.useMemo(() => {
    if (!creatorNameMap || creatorNameMap.size === 0) return chapterGroups;

    return chapterGroups.map((group) => ({
      ...group,
      versions: group.versions.map((v) => ({
        ...v,
        creatorName: v.creator_id
          ? (creatorNameMap.get(v.creator_id) ?? undefined)
          : undefined
      })),
      primary: {
        ...group.primary,
        creatorName: group.primary.creator_id
          ? (creatorNameMap.get(group.primary.creator_id) ?? undefined)
          : undefined
      }
    }));
  }, [chapterGroups, creatorNameMap]);

  const existingChapterNumbers = React.useMemo(
    () => new Set(chapters.map((g) => g.chapterNumber)),
    [chapters]
  );

  return {
    chapters,
    existingChapterNumbers,
    isLoading: isLoadingLocal,
    isLoadingCloud,
    error: localError
  };
}
