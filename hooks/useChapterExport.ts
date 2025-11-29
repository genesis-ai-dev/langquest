import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { system } from '@/db/powersync/system';
import { Alert, Share, Platform } from 'react-native';

export interface ExportRequest {
  quest_id: string;
  export_type: 'feedback' | 'distribution';
  environment?: 'production' | 'preview' | 'development';
}

export interface ExportResponse {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'ingested';
  audio_url?: string;
  share_url?: string;
  error_message?: string;
}

/**
 * Hook for exporting bible chapters
 */
export function useChapterExport() {
  const queryClient = useQueryClient();

  const exportMutation = useMutation<ExportResponse, Error, ExportRequest>({
    mutationFn: async (request: ExportRequest) => {
      const localhost =
        Platform.OS === 'android'
          ? 'http://10.0.2.2:3000'
          : 'http://localhost:3000';
      const siteUrl =
        process.env.EXPO_PUBLIC_SITE_URL ||
        (__DEV__ ? localhost : 'https://langquest.org');

      // Detect environment from Supabase URL if not provided
      let environment = request.environment;
      if (!environment) {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        // Check if it's local Supabase (development)
        if (
          supabaseUrl.includes('127.0.0.1') ||
          supabaseUrl.includes('localhost') ||
          supabaseUrl.includes(':54321')
        ) {
          environment = 'development';
        } else if (supabaseUrl.includes('preview')) {
          environment = 'preview';
        } else {
          environment = 'production';
        }
      }

      console.log('[Export] Using site URL:', siteUrl);
      console.log('[Export] Detected environment:', environment);
      console.log('[Export] Request:', { ...request, environment });

      // Get the current session token
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${siteUrl}/api/export/chapter`;
      console.log('[Export] Calling API:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ ...request, environment })
      });

      console.log('[Export] API Response Status:', response.status);

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        let errorMessage = `Export failed: ${response.statusText}`;
        if (isJson) {
          try {
            const errorData = await response.json();
            // Prefer debug.message if available (more helpful), otherwise use error
            errorMessage =
              errorData.debug?.message || errorData.error || errorMessage;
            console.log('[Export] Error details:', errorData);
          } catch {
            // JSON parse failed, try to get text
            const text = await response.text();
            errorMessage = `Export failed (${response.status}): ${text.substring(0, 200)}`;
          }
        } else {
          // Not JSON, get text response
          const text = await response.text();
          errorMessage = `Export failed (${response.status}): Expected JSON but got ${contentType || 'unknown'}. Response: ${text.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      if (!isJson) {
        const text = await response.text();
        throw new Error(
          `Expected JSON response but got ${contentType || 'unknown'}. Response: ${text.substring(0, 200)}`
        );
      }

      const data = await response.json();
      console.log('[Export] API Response Data:', data);
      return data as ExportResponse;
    },
    onSuccess: (data) => {
      // Invalidate export queries
      queryClient.invalidateQueries({
        queryKey: ['chapter-export', data.id]
      });
    }
  });

  return exportMutation;
}

/**
 * Hook for fetching export status
 */
export function useExportStatus(exportId: string | null) {
  return useQuery<ExportResponse, Error>({
    queryKey: ['chapter-export', exportId],
    queryFn: async () => {
      if (!exportId) {
        throw new Error('Export ID is required');
      }

      const localhost =
        Platform.OS === 'android'
          ? 'http://10.0.2.2:3000'
          : 'http://localhost:3000';
      const siteUrl =
        process.env.EXPO_PUBLIC_SITE_URL ||
        (__DEV__ ? localhost : 'https://langquest.org');

      // Get the current session token
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${siteUrl}/api/export/${exportId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        let errorMessage = `Failed to fetch export: ${response.statusText}`;
        if (isJson) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            const text = await response.text();
            errorMessage = `Failed to fetch export (${response.status}): ${text.substring(0, 200)}`;
          }
        } else {
          const text = await response.text();
          errorMessage = `Failed to fetch export (${response.status}): Expected JSON but got ${contentType || 'unknown'}. Response: ${text.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      if (!isJson) {
        const text = await response.text();
        throw new Error(
          `Expected JSON response but got ${contentType || 'unknown'}. Response: ${text.substring(0, 200)}`
        );
      }

      const data = await response.json();
      return data as ExportResponse;
    },
    enabled: !!exportId,
    refetchInterval: (query) => {
      // Poll while processing
      const data = query.state.data;
      if (data?.status === 'processing' || data?.status === 'pending') {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling when ready or failed
    }
  });
}

/**
 * Share export link using native share sheet
 */
export async function shareExportLink(shareUrl: string): Promise<void> {
  try {
    const result = await Share.share({
      message: shareUrl,
      url: shareUrl, // Some platforms prefer url over message
      title: 'Share Chapter Export'
    });

    if (result.action === Share.sharedAction) {
      if (result.activityType) {
        // Shared with activity type of result.activityType
        console.log('Shared via:', result.activityType);
      } else {
        // Shared
        console.log('Shared successfully');
      }
    } else if (result.action === Share.dismissedAction) {
      // Dismissed
      console.log('Share dismissed');
    }
  } catch (error) {
    console.error('Failed to share:', error);
    Alert.alert('Error', 'Failed to share export link');
  }
}
