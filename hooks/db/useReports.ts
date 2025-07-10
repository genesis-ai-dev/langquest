import { reports } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  convertToSupabaseFetchConfig,
  createHybridSupabaseQueryConfig,
  hybridSupabaseFetch,
  useHybridSupabaseQuery
} from '../useHybridSupabaseQuery';

export type Report = InferSelectModel<typeof reports>;

function getHasUserReportedConfig(
  record_id: string,
  record_table: string,
  reporter_id: string
) {
  return createHybridSupabaseQueryConfig({
    queryKey: ['report-check', record_id, record_table, reporter_id],
    onlineFn: async ({ signal }) => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', record_id)
        .eq('record_table', record_table)
        .eq('reporter_id', reporter_id)
        .abortSignal(signal)
        .overrideTypes<Report[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: system.db.query.reports.findMany({
      where: and(
        eq(reports.record_id, record_id),
        eq(reports.record_table, record_table),
        eq(reports.reporter_id, reporter_id)
      )
    }),
    enabled: !!record_id && !!record_table && !!reporter_id
  });
}

export async function hasUserReported(
  record_id: string,
  record_table: string,
  reporter_id: string
) {
  const reportArray = await hybridSupabaseFetch(
    convertToSupabaseFetchConfig(
      getHasUserReportedConfig(record_id, record_table, reporter_id)
    )
  );
  return (reportArray?.length || 0) > 0;
}

/**
 * Returns { hasReported, isLoading, error }
 * Checks if a user has already reported a specific record from Supabase (online) or local Drizzle DB (offline)
 */
export function useHasUserReported(
  record_id: string,
  record_table: string,
  reporter_id: string
) {
  const {
    data: reportArray,
    isLoading: isReportLoading,
    ...rest
  } = useHybridSupabaseQuery(
    getHasUserReportedConfig(record_id, record_table, reporter_id)
  );

  const hasReported = (reportArray?.length || 0) > 0;

  return { hasReported, isReportLoading, ...rest };
}

/**
 * Returns { reports, isLoading, error }
 * Fetches all reports for a specific record from Supabase (online) or local Drizzle DB (offline)
 */
export function useReportsByRecord(record_id: string, record_table: string) {
  const { db, supabaseConnector } = system;

  const {
    data: reportsList,
    isLoading: isReportsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['reports', 'by-record', record_id, record_table],
    onlineFn: async ({ signal }) => {
      const { data, error } = await supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', record_id)
        .eq('record_table', record_table)
        .abortSignal(signal)
        .overrideTypes<Report[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: db.query.reports.findMany({
      where: and(
        eq(reports.record_id, record_id),
        eq(reports.record_table, record_table)
      )
    }),
    enabled: !!record_id && !!record_table
  });

  return { reports: reportsList, isReportsLoading, ...rest };
}
