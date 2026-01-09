import { system } from '@/db/powersync/system';
import { useMutation } from '@tanstack/react-query';

export interface LocalizationRequest {
  phoneticText: string;
  examples: string[];
  languageName: string;
  model?: string;
}

export interface LocalizationResponse {
  localizedText: string;
  rawResponse?: string;
}

/**
 * Hook for calling the transcription localization Edge Function.
 *
 * Takes phonetic/approximated ASR output and converts it to proper orthography
 * using examples of correctly written text in the target language.
 */
export function useTranscriptionLocalization() {
  return useMutation<LocalizationResponse, Error, LocalizationRequest>({
    mutationFn: async (request: LocalizationRequest) => {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/localize-transcription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(request)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Unknown error'
        }));
        throw new Error(
          errorData.error || `Localization failed: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as LocalizationResponse;
    }
  });
}
