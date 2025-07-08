import { blockService } from '@/database_services/blockService';
import { reportService } from '@/database_services/reportService';
import { reasonOptions } from '@/db/constants';
import { reports } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';

/**
 * Hook for checking if a user has reported a specific record
 */
export const useHasUserReported = (
  recordId: string,
  recordTable: string,
  reporterId: string
) => {
  const { data: reportArray, isLoading } = useHybridQuery({
    queryKey: ['reports', 'hasReported', recordId, recordTable, reporterId],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', recordId)
        .eq('record_table', recordTable)
        .eq('reporter_id', reporterId);
      if (error) throw error;
      return data as Report[];
    },
    offlineQuery: toCompilableQuery(
      system.db.query.reports.findMany({
        where: and(
          eq(reports.record_id, recordId),
          eq(reports.record_table, recordTable),
          eq(reports.reporter_id, reporterId)
        )
      })
    ),
    enabled: !!recordId && !!recordTable && !!reporterId
  });

  const hasReported = (reportArray?.length ?? 0) > 0;
  return { hasReported, isLoading };
};

/**
 * Main useReports hook used by ReportModal and other components
 */
export const useReports = (
  recordId: string,
  recordTable: string,
  reporterId?: string
) => {
  const queryClient = useQueryClient();

  const createReportMutation = useMutation({
    mutationFn: async (data: {
      record_id: string;
      record_table: string;
      reporter_id: string;
      reason: typeof reasonOptions[number];
      details?: string;
    }) => {
      return await reportService.createReport(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['reports']
      });
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: async (data: {
      blocker_id: string;
      blocked_id: string;
    }) => {
      return await blockService.blockUser(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blockedUsers']
      });
    }
  });

  const blockContentMutation = useMutation({
    mutationFn: async (data: {
      profile_id: string;
      content_id: string;
      content_table: string;
    }) => {
      return await blockService.blockContent(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blockedContent']
      });
    }
  });

  return {
    createReport: createReportMutation.mutateAsync,
    isCreatingReport: createReportMutation.isPending,
    blockUser: blockUserMutation.mutateAsync,
    blockContent: blockContentMutation.mutateAsync
  };
};
