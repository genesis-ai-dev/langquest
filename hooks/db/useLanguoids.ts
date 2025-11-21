/**
 * @deprecated This file contains hooks for querying languoid data.
 * These hooks replace the language-based hooks in useLanguages.ts
 * as part of the migration from language table to languoid table.
 */

import { languoid } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

export type Languoid = InferSelectModel<typeof languoid>;

/**
 * Returns { languoids, isLoading, error }
 * Fetches all ui_ready languoids from Supabase (online) or local Drizzle DB (offline)
 */
export function useUIReadyLanguoids() {
  const { db, supabaseConnector } = system;

  const {
    data: languoids,
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
