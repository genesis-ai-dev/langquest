/**
 * Hook to query existing FIA pericope quests for a book within a project.
 * Modeled on useBibleChapters: queries local + cloud, merges with source tracking.
 * Uses metadata.fia.bookId and metadata.fia.pericopeId for identification.
 */

import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
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
}

interface QuestWithPericopeMeta {
  quest_id: string;
  quest_name: string;
  quest_source: HybridDataSource;
  quest_created_at: string;
  quest_download_profiles: string[] | null;
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
      if (typeof parsed === 'string') return JSON.parse(parsed);
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
      metadata: true
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
            typeof dp === 'string' ? JSON.parse(dp) : Array.isArray(dp) ? dp : null;
        } catch { /* ignore */ }
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
      .select('id, name, created_at, download_profiles, metadata')
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
        pericope_id: meta.fia.pericopeId
      });
    }
    return results;
  } catch {
    return [];
  }
}

function processPericopeResults(
  questResults: QuestWithPericopeMeta[]
): FiaPericopeQuest[] {
  if (questResults.length === 0) return [];

  const pericopeMap = new Map<
    string,
    {
      id: string;
      name: string;
      pericopeId: string;
      sources: Set<HybridDataSource>;
      download_profiles?: string[] | null;
      created_at: string;
    }
  >();

  const getSourcePriority = (source: HybridDataSource): number => {
    if (source === 'synced') return 3;
    if (source === 'local') return 2;
    return 1;
  };

  for (const q of questResults) {
    const existing = pericopeMap.get(q.pericope_id);

    if (!existing) {
      pericopeMap.set(q.pericope_id, {
        id: q.quest_id,
        name: q.quest_name,
        pericopeId: q.pericope_id,
        sources: new Set([q.quest_source]),
        download_profiles: q.quest_download_profiles,
        created_at: q.quest_created_at
      });
    } else if (normalizeUuid(q.quest_id) === normalizeUuid(existing.id)) {
      existing.sources.add(q.quest_source);
    } else {
      const existingPriority = Math.max(
        ...Array.from(existing.sources).map(getSourcePriority)
      );
      const newPriority = getSourcePriority(q.quest_source);

      if (
        newPriority > existingPriority ||
        (newPriority === existingPriority && q.quest_created_at > existing.created_at)
      ) {
        pericopeMap.set(q.pericope_id, {
          id: q.quest_id,
          name: q.quest_name,
          pericopeId: q.pericope_id,
          sources: new Set([q.quest_source]),
          download_profiles: q.quest_download_profiles,
          created_at: q.quest_created_at
        });
      }
    }
  }

  return Array.from(pericopeMap.values()).map(
    (p): FiaPericopeQuest => ({
      id: p.id,
      name: p.name,
      pericopeId: p.pericopeId,
      source: p.sources.has('synced')
        ? 'synced'
        : p.sources.has('local')
          ? 'local'
          : 'cloud',
      hasLocalCopy: p.sources.has('local'),
      hasSyncedCopy: p.sources.has('synced'),
      download_profiles: p.download_profiles
    })
  );
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

  const pericopes = React.useMemo(() => {
    const allResults = [...localResults, ...cloudResults];
    return processPericopeResults(allResults);
  }, [localResults, cloudResults]);

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
