import { useAuth } from '@/contexts/AuthContext';
import { blockService } from '@/database_services/blockService';
import { reportService } from '@/database_services/reportService';
import type { reasonOptions } from '@/db/constants';
import { reports } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';

/**
 * Hook for checking if a user has reported a specific record
 */
export const useHasUserReported = (
  recordId: string,
  recordTable: string
  // reporterId: string
) => {
  const { currentUser } = useAuth();
  if (!currentUser)
    return {
      hasReported: false,
      isLoading: false,
      refetch: () => null
    };

  const {
    data: reportArray,
    isLoading,
    refetch
  } = useHybridQuery({
    queryKey: ['reports', 'hasReported', recordId, recordTable, currentUser.id],
    offlineQuery: toMergeCompilableQuery(
      system.db.query.reports.findMany({
        where: and(
          eq(reports.record_id, recordId),
          eq(reports.record_table, recordTable),
          eq(reports.reporter_id, currentUser.id)
        )
      })
    ),
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('reports')
        .select('*')
        .eq('record_id', recordId)
        .eq('record_table', recordTable)
        .eq('reporter_id', currentUser.id);
      if (error) throw error;
      return data as Record<string, unknown>[];
    },
    enabled: !!recordId && !!recordTable && !!currentUser.id
  });

  const hasReported = reportArray.length > 0;
  return { hasReported, isLoading, refetch };
};

/**
 * Main useReports hook used by ReportModal and other components
 */
export const useReports = (
  _recordId: string,
  _recordTable: string,
  _reporterId?: string
) => {
  const queryClient = useQueryClient();

  const createReportMutation = useMutation({
    mutationFn: async (data: {
      record_id: string;
      record_table: string;
      reporter_id: string;
      reason: (typeof reasonOptions)[number];
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
    mutationFn: async (data: { blocker_id: string; blocked_id: string }) => {
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
