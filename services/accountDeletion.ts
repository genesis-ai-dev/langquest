import { system } from '@/db/powersync/system';

export interface ScheduledDeletionResult {
  deletion_requested_at: string;
  deletion_scheduled_for: string;
}

export async function requestAccountDeletion(): Promise<ScheduledDeletionResult> {
  const {
    data: { session },
    error: sessionError
  } = await system.supabaseConnector.client.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured');
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/request-account-deletion`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const body = (await response.json()) as ScheduledDeletionResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to schedule account deletion');
  }

  return body;
}
