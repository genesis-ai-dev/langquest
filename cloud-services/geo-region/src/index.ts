import dotenvx from '@dotenvx/dotenvx';

import envSrc from '../.env.txt';

const config = dotenvx.config({
	envs: [{ type: 'env', value: envSrc, privateKeyName: 'DOTENV_PRIVATE_KEY' }],
});
const envx = config.parsed;

export interface Env {}

const GEO_REGION_API_KEY_HEADER = 'X-LangQuest-Geo-Key';

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

const RESPONSE_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': `Content-Type, ${GEO_REGION_API_KEY_HEADER}`,
	'Cache-Control': 'no-store',
	'Content-Type': 'application/json',
} as const;

const GEO_REGION_PUBLIC_API_KEY_PATTERN = /^lq_geo_v1_[a-z0-9]+$/i;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: RESPONSE_HEADERS,
	});
}

function isEuEeaGbCountryCode(countryCode: string | null): boolean {
	return countryCode !== null && EU_EEA_GB_COUNTRY_CODES.has(countryCode);
}

function getExpectedApiKey(): string | null {
	const raw = envx?.GEO_REGION_PUBLIC_API_KEY?.trim();
	if (!raw || raw.startsWith('encrypted:')) {
		return null;
	}

	if (!GEO_REGION_PUBLIC_API_KEY_PATTERN.test(raw)) {
		return null;
	}

	return raw;
}

function isValidApiKey(provided: string | null, expected: string): boolean {
	if (!provided || provided.length !== expected.length) {
		return false;
	}

	let mismatch = 0;
	for (let index = 0; index < expected.length; index += 1) {
		mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
	}

	return mismatch === 0;
}

export default {
	async fetch(request: Request, _env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
		}

		if (request.method === 'GET' && pathname === '/') {
			return Response.json({ ok: true });
		}

		if (request.method !== 'GET') {
			return jsonResponse({ error: 'Method not allowed' }, 405);
		}

		if (pathname !== '/country') {
			return jsonResponse({ error: 'Not found' }, 404);
		}

		const expectedKey = getExpectedApiKey();
		if (!expectedKey) {
			return jsonResponse({ error: 'Server misconfiguration' }, 500);
		}

		if (!isValidApiKey(request.headers.get(GEO_REGION_API_KEY_HEADER), expectedKey)) {
			return jsonResponse({ error: 'Unauthorized' }, 401);
		}

		const rawCountry = request.cf?.country;
		const countryCode =
			typeof rawCountry === 'string' && rawCountry.trim().length > 0
				? rawCountry.trim().toUpperCase()
				: null;

		return jsonResponse({
			countryCode,
			isEuEeaGb: isEuEeaGbCountryCode(countryCode),
		});
	},
} satisfies ExportedHandler<Env>