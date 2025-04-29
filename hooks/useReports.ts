import { blockService } from '@/database_services/blockService';
import { reportService } from '@/database_services/reportService';
import type {
  blocked_content,
  blocked_users,
  reports
} from '@/db/drizzleSchema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useReports = (
  recordId: string,
  recordTable: string,
  reporterId?: string
) => {
  const queryClient = useQueryClient();

  const { data: hasReported } = useQuery({
    queryKey: ['reports', recordId, recordTable, reporterId],
    queryFn: async () => {
      console.log('recordId', recordId);
      console.log('recordTable', recordTable);
      console.log('reporterId', reporterId);
      return reportService.hasUserReported(recordId, recordTable, reporterId!);
    },
    enabled: !!reporterId
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: typeof reports.$inferInsert) => {
      return reportService.createReport(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [
          'reports',
          data.record_id,
          data.record_table,
          data.reporter_id
        ]
      });
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: async (data: typeof blocked_users.$inferInsert) => {
      try {
        const result = await blockService.blockUser(data);
        return result;
      } catch (error) {
        console.error('Error blocking user:', error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blocked_users', reporterId]
      });
    }
  });

  const blockContentMutation = useMutation({
    mutationFn: async (data: typeof blocked_content.$inferInsert) => {
      try {
        const result = await blockService.blockContent(data);
        return result;
      } catch (error) {
        console.error('Error blocking content:', error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['blocked_content', reporterId]
      });
    }
  });

  return {
    hasReported,
    createReport: createReportMutation.mutateAsync,
    isCreatingReport: createReportMutation.isPending,
    blockUser: blockUserMutation.mutateAsync,
    blockContent: blockContentMutation.mutateAsync
  };
};
