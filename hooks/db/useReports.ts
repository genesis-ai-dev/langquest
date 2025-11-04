import { reports } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';

export type Report = InferSelectModel<typeof reports>;

/**
 * Returns { hasReported, isLoading, error }
 * Checks if a user has already reported a specific record from Supabase (online) or local Drizzle DB (offline)
 */
export function useHasUserReported(
  record_id: string,
  record_table: string,
  reporter_id: string
) {
  const { data: reportArray, isLoading: isReportLoading } = useHybridData({
    dataType: 'reports',
    queryKeyParams: ['report-check', record_id, record_table, reporter_id],
    offlineQuery: toCompilableQuery(
      system.db.query.reports.findMany({
        where: and(
          eq(reports.record_id, record_id),
          eq(reports.record_table, record_table),
          eq(reports.reporter_id, reporter_id)
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', record_id)
        .eq('record_table', record_table)
        .eq('reporter_id', reporter_id)
        .overrideTypes<Report[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!record_id && !!record_table && !!reporter_id,
    getItemId: (item) => item.id
  });

  const hasReported = (reportArray.length || 0) > 0;

  return { hasReported, isLoading: isReportLoading };
}

/**
 * Returns { reports, isLoading, error }
 * Fetches all reports for a specific record from Supabase (online) or local Drizzle DB (offline)
 */
export function useReportsByRecord(record_id: string, record_table: string) {
  const { data: reportsList, isLoading: isReportsLoading } = useHybridData({
    dataType: 'reports',
    queryKeyParams: ['by-record', record_id, record_table],
    offlineQuery: toCompilableQuery(
      system.db.query.reports.findMany({
        where: and(
          eq(reports.record_id, record_id),
          eq(reports.record_table, record_table)
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', record_id)
        .eq('record_table', record_table)
        .overrideTypes<Report[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!record_id && !!record_table,
    getItemId: (item) => item.id
  });

  return { reports: reportsList, isLoading: isReportsLoading };
}
