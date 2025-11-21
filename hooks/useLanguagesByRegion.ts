import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';

export interface Languoid {
  id: string;
  name: string;
  level: 'family' | 'language' | 'dialect';
  parent_id: string | null;
  active: boolean;
  created_at: string;
  last_updated: string;
}

export interface LanguageByRegion extends Languoid {
  region_id: string;
  region_name: string;
}

/**
 * Hook to query languoids filtered by region
 * Uses the languoid_region join table to connect languoids to regions
 */
export function useLanguagesByRegion(regionId: string | null) {
  return useHybridData<LanguageByRegion>({
    dataType: 'languages-by-region',
    queryKeyParams: [regionId || ''],

    // Note: languoid and languoid_region tables don't exist in local SQLite
    // Use a dummy offline query that returns empty array
    offlineQuery: `SELECT '' as id, '' as name, '' as level, '' as parent_id, '' as region_id, '' as region_name, 0 as active, '' as created_at, '' as last_updated WHERE 1 = 0`,

    // Cloud query - fetch languoids filtered by region
    cloudQueryFn: async () => {
      if (!regionId) return [];

      // Query languoids via languoid_region join
      const { data, error } = await system.supabaseConnector.client
        .from('languoid_region')
        .select(
          `
          languoid_id,
          region_id,
          languoid:languoid_id (
            id,
            name,
            level,
            parent_id,
            active,
            created_at,
            last_updated
          ),
          region:region_id (
            name
          )
        `
        )
        .eq('region_id', regionId)
        .eq('active', true);

      if (error) throw error;

      // Transform the nested data structure
      const languages: LanguageByRegion[] = (data || []).map((item: any) => {
        const languoid = item.languoid;
        const region = item.region;

        return {
          id: languoid.id,
          name: languoid.name,
          level: languoid.level,
          parent_id: languoid.parent_id,
          active: languoid.active,
          created_at: languoid.created_at,
          last_updated: languoid.last_updated,
          region_id: item.region_id,
          region_name: region?.name || ''
        };
      });

      // Sort by name
      languages.sort((a, b) => a.name.localeCompare(b.name));

      return languages;
    },

    enableCloudQuery: !!regionId,
    enableOfflineQuery: false // Languoid tables don't exist locally
  });
}
