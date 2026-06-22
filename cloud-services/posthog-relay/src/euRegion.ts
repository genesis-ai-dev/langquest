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
	'GB',
]);

export function getEdgeCountryCode(request: Request): string | null {
	const raw = request.cf?.country;
	if (typeof raw !== 'string') {
		return null;
	}

	const countryCode = raw.trim().toUpperCase();
	return countryCode.length > 0 ? countryCode : null;
}

/** Block only when edge geo positively identifies EU, EEA, or GB. */
export function isKnownEuEeaGbCountry(request: Request): boolean {
	const countryCode = getEdgeCountryCode(request);
	return countryCode !== null && EU_EEA_GB_COUNTRY_CODES.has(countryCode);
}
