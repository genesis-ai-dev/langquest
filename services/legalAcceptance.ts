import { CURRENT_LEGAL_VERSION } from '@/constants/legalVersions';
import { system } from '@/db/powersync/system';

export async function syncLegalAcceptanceToAccount(acceptedAt: string) {
  try {
    const {
      data: { session }
    } = await system.supabaseConnector.client.auth.getSession();

    if (!session) {
      return;
    }

    const { error: profileError } = await system.supabaseConnector.client
      .from('profile')
      .update({
        terms_accepted: true,
        terms_accepted_at: acceptedAt,
        privacy_policy_version: CURRENT_LEGAL_VERSION
      })
      .eq('id', session.user.id);

    if (profileError) {
      throw profileError;
    }

    await system.supabaseConnector.client.auth.updateUser({
      data: {
        terms_accepted: true,
        terms_accepted_at: acceptedAt,
        privacy_policy_version: CURRENT_LEGAL_VERSION
      }
    });
  } catch (error) {
    console.warn('Failed to sync legal acceptance to account:', error);
  }
}
