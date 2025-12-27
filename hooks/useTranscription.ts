import { system } from '@/db/powersync/system';
import { useMutation } from '@tanstack/react-query';

export interface TranscriptionResponse {
  text: string;
  duration_s: number;
  inference_s: number;
}

/**
 * Hook for transcribing audio via the Modal ASR Edge Function
 */
export function useTranscription() {
  return useMutation<TranscriptionResponse, Error, { uri: string; mimeType?: string }>({
    mutationFn: async ({ uri, mimeType = 'audio/wav' }) => {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const { data: { session } } = await system.supabaseConnector.client.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // React Native FormData handles file URIs directly
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: mimeType,
        name: `recording.${mimeType.split('/')[1] || 'wav'}`
      } as unknown as Blob);

      const transcribeUrl = `${supabaseUrl}/functions/v1/transcribe`;
      console.log('[Transcription] Calling:', transcribeUrl);

      let response: Response;
      try {
        response = await fetch(transcribeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: formData
        });
      } catch (networkError) {
        console.error('[Transcription] Network error:', networkError);
        throw new Error(
          `Network error: Unable to reach transcription service at ${transcribeUrl}. ` +
            'Make sure the edge function is running (npm run supabase:serve-functions).'
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Transcription failed: ${response.statusText}`);
      }

      return await response.json();
    }
  });
}

