import { system } from '@/db/powersync/system';

interface DeepLinkResult {
  handled: boolean;
  type?: 'password-reset' | 'email-confirmation';
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
    // Set the session using the tokens from the deep link
    const { error } = await system.supabaseConnector.client.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token
    });

    if (error) {
      console.error('[DeepLinkHandler] Failed to set session:', error);
      return { handled: false };
    }

    // Determine the type of deep link based on the URL or token type
    let type: 'password-reset' | 'email-confirmation' = 'email-confirmation';

    // Check if this is a password reset link
    if (path.includes('reset-password') || params.type === 'recovery') {
      type = 'password-reset';
    }

    console.log(`[DeepLinkHandler] Successfully handled ${type} deep link`);
    console.log(
      '[DeepLinkHandler] Path includes reset-password?',
      path.includes('reset-password')
    );
    console.log('[DeepLinkHandler] Params type:', params.type);

    // The auth state change listener in AuthContext will handle the rest
    return { handled: true, type };
  } catch (error) {
    console.error('[DeepLinkHandler] Error handling deep link:', error);
    return { handled: false };
  }
}
