/**
 * Hook to query existing FIA pericope quests for a book within a project.
 * Modeled on useBibleChapters: queries local + cloud, merges with source tracking.
 * Preserves ALL distinct quest versions per pericope (different creators).
 */

import { profile, quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { eq, inArray } from 'drizzle-orm';
import React from 'react';
import { useNetworkStatus } from './useNetworkStatus';

export interface FiaPericopeQuest {
  id: string;
  name: string;
  pericopeId: string;
  source: HybridDataSource;
  hasLocalCopy: boolean;
  hasSyncedCopy: boolean;
  download_profiles?: string[] | null;
  creator_id: string | null;
  created_at: string;
  creatorName?: string;
}

export interface FiaPericopeGroup {
  pericopeId: string;
  versions: FiaPericopeQuest[];
  primary: FiaPericopeQuest;
}

interface QuestWithPericopeMeta {
  quest_id: string;
  quest_name: string;
  quest_source: HybridDataSource;
  quest_created_at: string;
  quest_download_profiles: string[] | null;
  quest_creator_id: string | null;
  pericope_id: string;
}

interface FiaMetadataShape {
  fia?: {
    bookId?: string;
    pericopeId?: string;
    verseRange?: string;
  };
}

function parseMetadata(raw: unknown): FiaMetadataShape | null {
  try {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string')
        return JSON.parse(parsed) as FiaMetadataShape;
      return parsed as FiaMetadataShape;
    }
    return raw as FiaMetadataShape;
  } catch {
    return null;
  }
}

async function fetchLocalPericopes(
  projectId: string,
  bookId: string
): Promise<QuestWithPericopeMeta[]> {
  const allQuests = await system.db.query.quest.findMany({
    where: eq(quest.project_id, projectId),
    columns: {
      id: true,
      name: true,
      source: true,
      created_at: true,
      download_profiles: true,
      metadata: true,
      creator_id: true
    }
  });

  return allQuests
    .map((q) => {
      const meta = parseMetadata(q.metadata);
      if (meta?.fia?.bookId !== bookId || !meta.fia.pericopeId) return null;

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
        pericope_id: meta.fia.pericopeId
      } satisfies QuestWithPericopeMeta;
    })
    .filter((x): x is QuestWithPericopeMeta => x !== null);
}

async function fetchCloudPericopes(
  projectId: string,
  bookId: string
): Promise<QuestWithPericopeMeta[]> {
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('id, name, created_at, download_profiles, metadata, creator_id')
      .eq('project_id', projectId)
      .not('metadata', 'is', null);

    if (error || !data) return [];

    const results: QuestWithPericopeMeta[] = [];
    for (const row of data) {
      const meta = parseMetadata(row.metadata);
      if (meta?.fia?.bookId !== bookId || !meta.fia.pericopeId) continue;

      results.push({
        quest_id: row.id,
        quest_name: row.name,
        quest_source: 'cloud' as HybridDataSource,
        quest_created_at: row.created_at ?? new Date().toISOString(),
        quest_download_profiles: row.download_profiles as string[] | null,
        quest_creator_id: (row.creator_id as string) ?? null,
        pericope_id: meta.fia.pericopeId
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
  pericopeId: string;
  sources: Set<HybridDataSource>;
  download_profiles?: string[] | null;
  created_at: string;
  creator_id: string | null;
}

/**
 * Groups quest results by pericopeId, keeping all distinct quest IDs.
 * Same quest ID appearing from both local and cloud = one entry with merged sources.
 */
function processPericopeResults(
  questResults: QuestWithPericopeMeta[]
): FiaPericopeGroup[] {
  if (questResults.length === 0) return [];

  // First: dedup by normalized quest ID (merge sources for same quest)
  const questMap = new Map<string, DeduplicatedVersion>();

  for (const q of questResults) {
    const normalizedId = normalizeUuid(q.quest_id);
    const existing = questMap.get(normalizedId);

    if (!existing) {
      questMap.set(normalizedId, {
        id: q.quest_id,
        name: q.quest_name,
        pericopeId: q.pericope_id,
        sources: new Set([q.quest_source]),
        download_profiles: q.quest_download_profiles,
        created_at: q.quest_created_at,
        creator_id: q.quest_creator_id
      });
    } else {
      existing.sources.add(q.quest_source);
      // Prefer synced/local download_profiles over cloud
      if (
        getSourcePriority(q.quest_source) >
        Math.max(...Array.from(existing.sources).map(getSourcePriority))
      ) {
        existing.download_profiles = q.quest_download_profiles;
      }
    }
  }

  // Second: group by pericopeId
  const pericopeGroups = new Map<string, DeduplicatedVersion[]>();

  for (const v of questMap.values()) {
    const group = pericopeGroups.get(v.pericopeId) ?? [];
    group.push(v);
    pericopeGroups.set(v.pericopeId, group);
  }

  // Third: build output groups, sorting versions by priority then date
  return Array.from(pericopeGroups.entries()).map(([pericopeId, versions]) => {
    const mapped: FiaPericopeQuest[] = versions
      .map((v) => ({
        id: v.id,
        name: v.name,
        pericopeId: v.pericopeId,
        source: (v.sources.has('synced')
          ? 'synced'
          : v.sources.has('local')
            ? 'local'
            : 'cloud') as HybridDataSource,
        hasLocalCopy: v.sources.has('local'),
        hasSyncedCopy: v.sources.has('synced'),
        download_profiles: v.download_profiles,
        creator_id: v.creator_id,
        created_at: v.created_at
      }))
      .sort((a, b) => {
        const aPriority = getSourcePriority(a.source);
        const bPriority = getSourcePriority(b.source);
        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.created_at.localeCompare(a.created_at);
      });

    return {
      pericopeId,
      versions: mapped,
      primary: mapped[0]!
    };
  });
}

export function useFiaPericopes(projectId: string, bookId: string) {
  const isOnline = useNetworkStatus();

  const {
    data: localResults = [],
    isLoading: isLoadingLocal,
    error: localError
  } = useQuery({
    queryKey: ['fia-pericope-quests', 'local', projectId, bookId],
    queryFn: () => fetchLocalPericopes(projectId, bookId),
    enabled: !!projectId && !!bookId,
    staleTime: 30000
  });

  const { data: cloudResults = [], isLoading: isLoadingCloud } = useQuery({
    queryKey: ['fia-pericope-quests', 'cloud', projectId, bookId],
    queryFn: () => fetchCloudPericopes(projectId, bookId),
    enabled: !!projectId && !!bookId && isOnline,
    staleTime: 60000
  });

  // Process quest results into grouped pericopes, then attach creator names
  const pericopeGroups = React.useMemo(() => {
    const allResults = [...localResults, ...cloudResults];
    return processPericopeResults(allResults);
  }, [localResults, cloudResults]);

  // Batch-fetch creator names
  const creatorIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const group of pericopeGroups) {
      for (const v of group.versions) {
        if (v.creator_id) ids.add(v.creator_id);
      }
    }
    return Array.from(ids);
  }, [pericopeGroups]);

  const { data: creatorNameMap } = useQuery({
    queryKey: ['profile-names', ...creatorIds.sort()],
    queryFn: () => fetchCreatorNames(creatorIds),
    enabled: creatorIds.length > 0,
    staleTime: 300000
  });

  // Attach names to versions
  const pericopes = React.useMemo(() => {
    if (!creatorNameMap || creatorNameMap.size === 0) return pericopeGroups;

    return pericopeGroups.map((group) => ({
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
  }, [pericopeGroups, creatorNameMap]);

  const existingPericopeIds = React.useMemo(
    () => new Set(pericopes.map((p) => p.pericopeId)),
    [pericopes]
  );

  return {
    pericopes,
    existingPericopeIds,
    isLoading: isLoadingLocal,
    isLoadingCloud,
    error: localError
  };
}
