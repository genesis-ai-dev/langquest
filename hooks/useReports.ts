import { reports } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hasUserReported } from './db/useReports';

export const useReportUserHasReported = (
  recordId: string,
  recordTable: string,
  reporterId: string
) => {
  const queryClient = useQueryClient();

  const { data: hasReported } = useHybridQuery({
    queryKey: ['reports', recordId, recordTable, reporterId],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('id')
        .eq('record_id', recordId)
        .eq('record_table', recordTable)
        .eq('reporter_id', reporterId)
        .limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    offlineQuery: toCompilableQuery(
      hasUserReported(system.db, recordId, recordTable, reporterId)
    ),
    enabled: !!recordId && !!recordTable && !!reporterId
  });

  const reportMutation = useMutation({
    mutationFn: async ({
      reportType,
      description
    }: {
      reportType: string;
      description: string;
    }) => {
      return await system.db.insert(reports).values({
        record_id: recordId,
        record_table: recordTable,
        reporter_id: reporterId,
        report_type: reportType,
        description
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['reports', recordId, recordTable, reporterId]
      });
    }
  });

  return {
    hasReported,
    reportMutation
  };
};
