import { system } from '@/db/powersync/system';
import { useMutation } from '@tanstack/react-query';

export interface PredictionRequest {
  sourceText: string;
  examples: Array<{ source: string; target: string }>;
  sourceLanguageName: string;
  targetLanguageName: string;
  model?: string;
}

export interface PredictionResponse {
  translation: string;
  rawResponse?: string;
}

/**
 * Hook for calling the translation prediction Edge Function
 */
export function useTranslationPrediction() {
  return useMutation<PredictionResponse, Error, PredictionRequest>({
    mutationFn: async (request: PredictionRequest) => {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      // Get the current session token
      const {
        data: { session }
      } = await system.supabaseConnector.client.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/predict-translation`,
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
          errorData.error || `Prediction failed: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as PredictionResponse;
    }
  });
}
