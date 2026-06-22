import { getLocales } from 'expo-localization';

/** EU member states, EEA (IS, LI, NO), and GB (UK GDPR). */
export const EU_EEA_GB_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB'
]);

export function getDeviceRegionCode(): string | null {
  for (const locale of getLocales()) {
    const regionCode = locale.regionCode?.trim().toUpperCase();
    if (regionCode) {
      return regionCode;
    }
  }

  return null;
}

export function isEuEeaGbCountryCode(
  countryCode: string | null | undefined
): boolean {
  if (!countryCode) {
    return false;
  }

  return EU_EEA_GB_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

export function isEuDeviceRegion(): boolean {
  return isEuEeaGbCountryCode(getDeviceRegionCode());
}
