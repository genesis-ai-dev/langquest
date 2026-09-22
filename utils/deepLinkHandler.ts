import { system } from '@/db/powersync/system';
import { router } from 'expo-router';

export interface DeepLinkResult {
  handled: boolean;
  type?: 'password-reset' | 'email-confirmation' | 'invite';
  navigateTo?: string;
  params?: Record<string, string>;
}

let pendingPasswordRecovery = false;

/** SIGNED_IN from setSession() is not PASSWORD_RECOVERY. Call before setSession. */
export function consumePendingPasswordRecovery() {
  const pending = pendingPasswordRecovery;
  pendingPasswordRecovery = false;
  return pending;
}

interface ParsedDeepLink {
  path: string;
  params: Record<string, string>;
}

function parseDeepLink(url: string): ParsedDeepLink {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};

    // Parse URL search params
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Also parse hash params (Supabase often puts tokens in the hash)
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    return {
      path: urlObj.hostname + urlObj.pathname, // Include hostname in path
      params
    };
  } catch (error) {
    console.error('[DeepLinkHandler] Error parsing URL:', error);
    return {
      path: '',
      params: {}
    };
  }
}

export async function handleAuthDeepLink(url: string): Promise<DeepLinkResult> {
  console.log('[DeepLinkHandler] Processing deep link:', url);

  const { params, path } = parseDeepLink(url);

  console.log('[DeepLinkHandler] Parsed deep link:', {
    path,
    params: {
      ...params,
      access_token: params.access_token ? '[REDACTED]' : undefined,
      refresh_token: params.refresh_token ? '[REDACTED]' : undefined,
      type: params.type,
      token_type: params.token_type,
      expires_in: params.expires_in
    }
  });

  // Check if this is an auth-related deep link
  if (!params.access_token || !params.refresh_token) {
    console.log('[DeepLinkHandler] No auth tokens found in URL');
    return { handled: false };
  }

  try {
    const isRecovery =
      path.includes('reset-password') || params.type === 'recovery';
    if (isRecovery) {
      pendingPasswordRecovery = true;
    }

    // Set the session using the tokens from the deep link
    const { error } = await system.supabaseConnector.client.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token
    });

    if (error) {
      pendingPasswordRecovery = false;
      console.error('[DeepLinkHandler] Failed to set session:', error);
      return { handled: false };
    }

    const type: 'password-reset' | 'email-confirmation' = isRecovery
      ? 'password-reset'
      : 'email-confirmation';

    console.log(`[DeepLinkHandler] Successfully handled ${type} deep link`);
    console.log(
      '[DeepLinkHandler] Path includes reset-password?',
      path.includes('reset-password')
    );
    console.log('[DeepLinkHandler] Params type:', params.type);

    if (type === 'password-reset') {
      router.replace('/reset-password');
    }

    return { handled: true, type };
  } catch (error) {
    pendingPasswordRecovery = false;
    console.error('[DeepLinkHandler] Error handling deep link:', error);
    return { handled: false };
  }
}
