import { useMutation, useQueryClient } from '@tanstack/react-query';
import { system } from '@/db/powersync/system';

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
      const siteUrl = process.env.EXPO_PUBLIC_SITE_URL!;

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
