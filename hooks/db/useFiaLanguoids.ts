import { languoid } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import type { InferSelectModel } from 'drizzle-orm';
import { useMemo } from 'react';
import { useLanguoidEndonyms } from './useLanguoids';

type Languoid = InferSelectModel<typeof languoid>;

/**
 * Returns languoids that have FIA content available, along with their endonyms.
 * Filters by languoid_property records where key='fia_available' and value='true'.
 */
export function useFiaLanguoids() {
  const { supabaseConnector } = system;

  const {
    data: fiaLanguoids,
    isLoading: isFiaLanguoidsLoading,
    ...rest
  } = useHybridData({
    dataType: 'languoids-fia-available',
    queryKeyParams: ['fia-available'],

    // PowerSync offline query: get languoid_property rows, then fetch matching languoids
    offlineQuery: `
      SELECT l.*
      FROM languoid l
      INNER JOIN languoid_property lp ON lp.languoid_id = l.id
      WHERE lp.key = 'fia_available'
        AND lp.value = 'true'
        AND l.active = 1
      ORDER BY l.name
    `,

    // Cloud query via Supabase
    cloudQueryFn: async () => {
      // First get the languoid IDs that have fia_available = true
      const { data: properties, error: propError } =
        await supabaseConnector.client
          .from('languoid_property')
          .select('languoid_id')
          .eq('key', 'fia_available')
          .eq('value', 'true')
          .eq('active', true);
      if (propError) throw propError;
      if (!properties?.length) return [];

      const languoidIds = properties.map((p) => p.languoid_id);

      const { data, error } = await supabaseConnector.client
        .from('languoid')
        .select('*')
        .in('id', languoidIds)
        .eq('active', true)
        .order('name')
        .overrideTypes<Languoid[]>();
      if (error) throw error;
      return data;
    }
  });

  // Fetch endonyms for the FIA languoids
  const fiaLanguoidIds = useMemo(
    () => fiaLanguoids.map((l) => l.id),
    [fiaLanguoids]
  );
  const { endonymMap } = useLanguoidEndonyms(fiaLanguoidIds);

  // Build dropdown-ready data: "endonym (English name)" or just the name
  const fiaDropdownData = useMemo(
    () =>
      fiaLanguoids.map((lang) => {
        const endonym = endonymMap.get(lang.id);
        const englishName = lang.name ?? lang.id;
        const label =
          endonym && endonym !== englishName
            ? `${endonym} (${englishName})`
            : englishName;
        return { label, value: lang.id };
      }),
    [fiaLanguoids, endonymMap]
  );

  return {
    fiaLanguoids,
    fiaDropdownData,
    isFiaLanguoidsLoading,
    ...rest
  };
}
