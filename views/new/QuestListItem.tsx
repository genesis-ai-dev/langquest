import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import type { Quest } from '@/hooks/db/useQuests';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './NextGenQuestsView';

// Define props locally to avoid require cycle
export interface QuestListItemProps {
  quest: Quest & { source?: string };
}

function renderSourceTag(source: string | undefined) {
  if (source === 'cloudSupabase') {
    return <Text style={{ color: 'red' }}>Cloud</Text>;
  }
  return <Text style={{ color: 'blue' }}>Offline</Text>;
}

interface DownloadResponse {
  success: boolean;
  message?: string;
  count?: number;
  details?: unknown;
}

/**
 * Calls the download_quest_closure RPC with the current quest and user IDs.
 * Returns the result or throws on error.
 *
 * Usage:
 *   const { mutate: downloadQuestClosure, ... } = useDownloadQuestClosure();
 *   downloadQuestClosure({ questId, userId });
 */
function useDownloadQuestClosure() {
  return useMutation({
    mutationFn: async ({
      questId,
      userId
    }: {
      questId: string;
      userId: string;
    }): Promise<DownloadResponse> => {
      console.log('🚀 Starting download_quest_closure RPC call');
      console.log('📋 Parameters:', { questId, userId });

      if (!questId || !userId) {
        const error = new Error('questId and userId are required');
        console.error('❌ Validation failed:', error.message);
        throw error;
      }

      console.log('🔄 Calling Supabase RPC...');
      const startTime = Date.now();

      // Call the RPC on Supabase
      const result = await system.supabaseConnector.client.rpc(
        'download_quest_closure',
        {
          quest_id_param: questId,
          profile_id_param: userId
        }
      );

      const data = result.data as unknown as DownloadResponse;
      const error = result.error;

      const duration = Date.now() - startTime;
      console.log(`⏱️ RPC call completed in ${duration}ms`);

      if (error) {
        console.error('❌ RPC Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ RPC Success - Raw Response:', data);
      console.log('📊 Response Type:', typeof data);
      console.log(
        '📊 Response Keys:',
        data && typeof data === 'object'
          ? Object.keys(data as unknown as Record<string, unknown>)
          : 'null/undefined/primitive'
      );

      // Type the response properly
      const response: DownloadResponse = {
        success: true,
        message: 'Download completed successfully',
        details: data as unknown
      };

      console.log('🎉 Processed Response:', response);
      return response;
    }
  });
}

type DownloadStatus = 'idle' | 'loading' | 'success' | 'error';

export const QuestListItem: React.FC<QuestListItemProps> = ({ quest }) => {
  const { goToQuest } = useAppNavigation();
  const { mutate: downloadQuestClosure, isPending: isDownloading } =
    useDownloadQuestClosure();

  const [downloadStatus, setDownloadStatus] =
    React.useState<DownloadStatus>('idle');
  const [downloadResult, setDownloadResult] =
    React.useState<DownloadResponse | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // TODO: Replace with real user ID from auth context/session
  const { currentUser: user } = useAuth();

  const handlePress = () => {
    goToQuest({
      id: quest.id,
      project_id: quest.project_id,
      name: quest.name
    });
  };

  const handleDownload = () => {
    if (!quest.id || !user) return;

    console.log('🎯 User initiated download for quest:', quest.name);
    setDownloadStatus('loading');
    setDownloadError(null);
    setDownloadResult(null);

    downloadQuestClosure(
      { questId: quest.id, userId: user.id },
      {
        onSuccess: (response) => {
          console.log('🎉 Download SUCCESS in UI:', response);
          setDownloadStatus('success');
          setDownloadResult(response);
        },
        onError: (err) => {
          console.error('❌ Download ERROR in UI:', err);
          setDownloadStatus('error');
          setDownloadError(
            err instanceof Error ? err.message : 'Unknown error occurred'
          );
        }
      }
    );
  };

  const getDownloadIcon = () => {
    switch (downloadStatus) {
      case 'loading':
        return 'cloud-download-outline';
      case 'success':
        return 'checkmark-done';
      case 'error':
        return 'close-circle-outline';
      default:
        return 'arrow-down-circle-outline';
    }
  };

  const getDownloadColor = () => {
    switch (downloadStatus) {
      case 'success':
        return colors.success;
      case 'error':
        return '#ff4444';
      case 'loading':
        return colors.primary;
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.listItem}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {renderSourceTag(quest.source)}
            <Text style={[styles.questName, { marginLeft: 8, flexShrink: 1 }]}>
              {quest.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleDownload}
            disabled={isDownloading}
            style={{
              marginLeft: 12,
              opacity: isDownloading ? 0.5 : 1,
              padding: 4
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={getDownloadIcon()}
              size={24}
              color={getDownloadColor()}
            />
          </TouchableOpacity>
        </View>

        {quest.description && (
          <Text style={styles.description} numberOfLines={2}>
            {quest.description}
          </Text>
        )}

        {/* Download Status Display */}
        {downloadStatus !== 'idle' && (
          <View
            style={{
              marginTop: 8,
              padding: 8,
              backgroundColor: '#f5f5f5',
              borderRadius: 4
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: getDownloadColor()
              }}
            >
              Status: {downloadStatus.toUpperCase()}
            </Text>

            {downloadStatus === 'loading' && (
              <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                Downloading quest data...
              </Text>
            )}

            {downloadStatus === 'success' && downloadResult && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: colors.success }}>
                  ✅ {downloadResult.message}
                </Text>
                {downloadResult.details && (
                  <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                    Response:{' '}
                    {typeof downloadResult.details === 'string'
                      ? downloadResult.details
                      : JSON.stringify(downloadResult.details, null, 2)}
                  </Text>
                )}
              </View>
            )}

            {downloadStatus === 'error' && downloadError && (
              <Text style={{ fontSize: 11, color: '#ff4444', marginTop: 2 }}>
                ❌ Error: {downloadError}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
