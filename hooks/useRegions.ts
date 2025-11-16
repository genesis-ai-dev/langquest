import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { sql } from 'drizzle-orm';

export interface Region {
  id: string;
  name: string;
  level: 'continent' | 'nation' | 'subnational';
  parent_id: string | null;
  active: boolean;
  created_at: string;
  last_updated: string;
}

/**
 * Hook to query regions from the region table
 * Filters by level (continent or nation)
 */
export function useRegions(levels: ('continent' | 'nation')[] = ['continent', 'nation']) {
  return useHybridData<Region>({
    dataType: 'regions',
    queryKeyParams: [levels.join(',')],
    
    // Note: region table doesn't exist in local SQLite, so we'll only query cloud
    // Use a dummy offline query that returns empty array
    offlineQuery: toCompilableQuery(
      sql`SELECT '' as id, '' as name, '' as level, '' as parent_id, 0 as active, '' as created_at, '' as last_updated WHERE 1 = 0`
    ),
    
    // Cloud query - fetch regions from Supabase
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('region')
        .select('*')
        .in('level', levels)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as Region[];
    },
    
    enableCloudQuery: true,
    enableOfflineQuery: false // Region table doesn't exist locally
  });
}

