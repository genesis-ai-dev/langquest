import { getLocales } from 'expo-localization';

/** EU member states, EEA (IS, LI, NO), and GB (UK GDPR). */
const EU_EEA_GB_COUNTRY_CODES = new Set([
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

export function isEuDeviceRegion(): boolean {
  const regionCode = getDeviceRegionCode();
  if (!regionCode) {
    return false;
  }

  return EU_EEA_GB_COUNTRY_CODES.has(regionCode);
}
