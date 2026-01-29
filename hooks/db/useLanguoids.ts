/**
 * @deprecated This file contains hooks for querying languoid data.
 * These hooks replace the language-based hooks in useLanguages.ts
 * as part of the migration from language table to languoid table.
 */

import { languoid } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { SUPPORTED_LANGUAGE_NAMES } from '@/services/localizations';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, sql } from 'drizzle-orm';
import { useMemo } from 'react';

export type Languoid = InferSelectModel<typeof languoid>;

/**
 * Returns { languoids, isLoading, error }
 * Fetches all ui_ready languoids from Supabase (online) or local Drizzle DB (offline)
 * Filters to only include languages with local app support to prevent
 * showing languages from newer DB versions that the app can't render.
 */
export function useUIReadyLanguoids() {
  const { db, supabaseConnector } = system;

  const {
    data: rawLanguoids,
    isLoading: isLanguoidsLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoids-ui-ready',
    queryKeyParams: ['ui-ready'],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.languoid.findMany({
        where: (languoidTable, { eq, and }) =>
          and(eq(languoidTable.active, true), eq(languoidTable.ui_ready, true))
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('languoid')
        .select('*')
        .eq('active', true)
        .eq('ui_ready', true)
        .overrideTypes<Languoid[]>();
      if (error) throw error;
      return data;
    }
  });

  // Filter to only include languages with local app support
  // This prevents older app versions from showing languages they can't render
  const languoids = useMemo(
    () =>
      rawLanguoids.filter(
        (l) => l.name && SUPPORTED_LANGUAGE_NAMES.has(l.name.toLowerCase())
      ),
    [rawLanguoids]
  );

  return { languoids, isLanguoidsLoading, ...rest };
}

/**
 * Returns { languoids, isLoading, error }
 * Fetches all active languoids from Supabase (online) or local Drizzle DB (offline)
 * Subscribes to Supabase realtime and updates cache on changes
 */
export function useLanguoids() {
  const { db, supabaseConnector } = system;

  // Main query using hybrid realtime query
  const {
    data: languoids,
    isLoading: isLanguoidsLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoids',
    queryKeyParams: [],
    offlineQuery: toCompilableQuery(
      db.query.languoid.findMany({
        where: eq(languoid.active, true)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('languoid')
        .select('*')
        .eq('active', true)
        .overrideTypes<Languoid[]>();
      if (error) throw error;
      return data;
    }
  });

  return { languoids, isLanguoidsLoading, ...rest };
}

/**
 * Returns { languoids, isLoading, error }
 * Fetches languoid names by IDs
 */
export function useLanguoidNames(languoidIds: string[] | string) {
  const { db, supabaseConnector } = system;

  const languoidIdsArray = Array.isArray(languoidIds)
    ? languoidIds
    : [languoidIds];

  // Main query using hybrid data
  const {
    data: languoids,
    isLoading: isLanguoidsLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoid-names',
    queryKeyParams: [languoidIdsArray.join(',')],
    offlineQuery: toCompilableQuery(
      db.query.languoid.findMany({
        columns: { id: true, name: true },
        where: (fields, { eq, inArray, and }) =>
          and(eq(fields.active, true), inArray(fields.id, languoidIdsArray))
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('languoid')
        .select('id, name')
        .eq('active', true)
        .in('id', languoidIdsArray)
        .overrideTypes<{ id: string; name: string | null }[]>();
      if (error) throw error;
      return data;
    }
  });

  return { languoids, isLanguoidsLoading, ...rest };
}

/**
 * Returns { languoid, isLoading, error }
 * Fetches a single languoid by ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useLanguoidById(languoid_id?: string) {
  const { db, supabaseConnector } = system;

  const {
    data: languoidArray,
    isLoading: isLanguoidLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoid-by-id',
    queryKeyParams: [languoid_id || ''],
    offlineQuery: toCompilableQuery(
      db.query.languoid.findMany({
        where: eq(languoid.id, languoid_id!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('languoid')
        .select('*')
        .eq('id', languoid_id)
        .overrideTypes<Languoid[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!languoid_id,
    enableOfflineQuery: !!languoid_id
  });

  const languoid_result = languoidArray[0] || null;

  return { languoid: languoid_result, isLanguoidLoading, ...rest };
}

/**
 * Returns a map of languoid_id -> endonym name
 * Fetches endonyms (native names) for a list of languoids
 * Prefers endonyms where label_languoid_id = subject_languoid_id (self-referential)
 * Only includes endonyms that have 'lexvo' in their source_names array
 */
export function useLanguoidEndonyms(languoidIds: string[]) {
  const { db, supabaseConnector } = system;

  const {
    data: aliases,
    isLoading: isEndonymsLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoid-endonyms',
    queryKeyParams: [languoidIds.sort().join(',')],
    enabled: languoidIds.length > 0,
    offlineQuery: toCompilableQuery(
      db.query.languoid_alias.findMany({
        columns: {
          subject_languoid_id: true,
          label_languoid_id: true,
          name: true
        },
        where: (fields, { eq, and, inArray }) =>
          and(
            eq(fields.alias_type, 'endonym'),
            eq(fields.active, true),
            inArray(fields.subject_languoid_id, languoidIds),
            sql`'lexvo' = ANY(${fields.source_names})`
          )
      })
    ),
    cloudQueryFn: async () => {
      if (languoidIds.length === 0) return [];
      const { data, error } = await supabaseConnector.client
        .from('languoid_alias')
        .select('subject_languoid_id, label_languoid_id, name')
        .eq('alias_type', 'endonym')
        .eq('active', true)
        .in('subject_languoid_id', languoidIds)
        .contains('source_names', ['lexvo'])
        .overrideTypes<
          {
            subject_languoid_id: string;
            label_languoid_id: string;
            name: string;
          }[]
        >();
      if (error) throw error;
      return data;
    }
  });

  // Create a map: prefer self-referential endonyms (label_languoid_id = subject_languoid_id)
  const endonymMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!aliases) return map;

    // First pass: collect self-referential endonyms (preferred)
    const selfReferential = aliases.filter(
      (alias) => alias.subject_languoid_id === alias.label_languoid_id
    );
    selfReferential.forEach((alias) => {
      if (!map.has(alias.subject_languoid_id)) {
        map.set(alias.subject_languoid_id, alias.name);
      }
    });

    // Second pass: fill in missing ones with any endonym
    aliases.forEach((alias) => {
      if (!map.has(alias.subject_languoid_id)) {
        map.set(alias.subject_languoid_id, alias.name);
      }
    });

    return map;
  }, [aliases]);

  return { endonymMap, isEndonymsLoading, ...rest };
}

/**
 * Search result type from the RPC function
 */
export interface LanguoidSearchResult {
  id: string;
  name: string | null;
  level: string | null;
  ui_ready: boolean | null;
  parent_id: string | null;
  matched_alias_name: string | null;
  matched_alias_type: string | null;
  iso_code: string | null;
  search_rank: number;
}

/**
 * Search languoids by name and aliases
 * When online: calls RPC function for server-side search across 300k+ records
 * When offline: falls back to local LIKE query on synced data
 *
 * @param searchQuery - The search term (minimum 2 characters)
 * @param options - Search options
 * @returns Search results with loading/error state
 */
export function useLanguoidSearch(
  searchQuery: string,
  options: {
    limit?: number;
    uiReadyOnly?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { limit = 50, uiReadyOnly = false, enabled = true } = options;
  const { db, supabaseConnector } = system;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isQueryValid = normalizedQuery.length >= 2;

  const {
    data: results,
    isLoading,
    ...rest
  } = useHybridData<LanguoidSearchResult>({
    dataType: 'languoid-search',
    queryKeyParams: [normalizedQuery, String(limit), String(uiReadyOnly)],

    // Offline query using local LIKE
    offlineQuery: toCompilableQuery(
      db
        .select({
          id: languoid.id,
          name: languoid.name,
          level: languoid.level,
          ui_ready: languoid.ui_ready,
          parent_id: languoid.parent_id,
          matched_alias_name: sql<string | null>`null`,
          matched_alias_type: sql<string | null>`null`,
          iso_code: sql<string | null>`null`,
          search_rank: sql<number>`
            case
              when lower(${languoid.name}) = ${normalizedQuery} then 1
              when lower(${languoid.name}) like ${normalizedQuery + '%'} then 2
              else 3
            end
          `
        })
        .from(languoid)
        .where(
          and(
            eq(languoid.active, true),
            uiReadyOnly ? eq(languoid.ui_ready, true) : undefined,
            sql`lower(${languoid.name}) like ${'%' + normalizedQuery + '%'}`
          )
        )
        .orderBy(
          sql`case
            when lower(${languoid.name}) = ${normalizedQuery} then 1
            when lower(${languoid.name}) like ${normalizedQuery + '%'} then 2
            else 3
          end`,
          languoid.name
        )
        .limit(limit)
    ),

    // Online query using RPC function
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client.rpc(
        'search_languoids',
        {
          search_query: normalizedQuery,
          result_limit: limit,
          ui_ready_only: uiReadyOnly
        }
      );

      if (error) throw error;
      return (data as LanguoidSearchResult[]) || [];
    },

    enableCloudQuery: isQueryValid && enabled,
    enableOfflineQuery: isQueryValid && enabled
  });

  return {
    results: isQueryValid ? results : [],
    isLoading: isQueryValid ? isLoading : false,
    isQueryValid,
    ...rest
  };
}

// Standalone function for use outside React components (like Zustand stores)
export async function getLanguoidById(
  languoid_id: string
): Promise<Languoid | null> {
  try {
    // Try online first
    const { data, error } = await system.supabaseConnector.client
      .from('languoid')
      .select('*')
      .eq('id', languoid_id)
      .single<Languoid>();

    if (!error) {
      return data;
    }

    // Fallback to offline
    const offlineResult = await system.db.query.languoid.findFirst({
      where: eq(languoid.id, languoid_id)
    });

    return offlineResult || null;
  } catch (error) {
    console.error('Error fetching languoid by ID:', error);
    return null;
  }
}
