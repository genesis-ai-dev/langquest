import { Linking } from 'react-native';

const CC0_DEED_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** Opens legal documents in the system browser (same pattern as TermsView). */
export async function openLegalUrl(
  target: 'terms' | 'privacy' | 'privacy-archive' | 'cc0'
) {
  const url =
    target === 'cc0'
      ? CC0_DEED_URL
      : target === 'privacy-archive'
        ? `${process.env.EXPO_PUBLIC_SITE_URL}/privacy/archive`
        : `${process.env.EXPO_PUBLIC_SITE_URL}/${target === 'terms' ? 'terms' : 'privacy'}`;

  await Linking.openURL(url);
}
