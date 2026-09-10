import { system } from '@/db/powersync/system';
import { invalidateCloud } from '@/hooks/hybridCache';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';

export function useItemDownloadStatus(
  item: { download_profiles?: string[] | null } | undefined,
  userId: string | undefined
): boolean {
  return React.useMemo(() => {
    if (!item || !userId || !item.download_profiles) return false;
    return item.download_profiles.includes(userId);
  }, [userId, item]);
}

export function useItemDownload(
  itemType: 'project' | 'quest' | 'asset',
  itemId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      download
    }: {
      userId: string;
      download: boolean;
    }) => {
      if (itemType === 'quest') {
        if (download) {
          const result = await system.supabaseConnector.client.rpc(
            'download_quest_closure',
            {
              quest_id_param: itemId,
              profile_id_param: userId
            }
          );
          if (result.error) throw result.error;
          return result.data as boolean;
        } else {
          console.warn('Undownload not yet implemented for quest_closure');
          return null;
        }
      } else {
        const { error } = await system.supabaseConnector.client.rpc(
          'download_record',
          {
            p_table_name: itemType,
            p_record_id: itemId,
            p_operation: download ? 'add' : 'remove'
          }
        );
        if (error) throw error;
        return true;
      }
    },
    onSuccess: () => {
      const types = ['download-status', 'my-projects', 'all-projects'];
      if (itemType === 'project') types.push('project');
      else types.push(itemType + 's');
      if (itemType === 'quest') types.push('assets');
      void invalidateCloud(queryClient, ...types);
    }
  });
}
