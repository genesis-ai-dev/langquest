import { isKnownEuEeaGbCountry } from './euRegion';

export interface Env {}

function resolveUpstreamUrl(pathname: string, search: string): URL | null {
	if (pathname.startsWith('/ingest/static/')) {
		const path = pathname.slice('/ingest/static/'.length);
		return new URL(`https://us-assets.i.posthog.com/static/${path}${search}`);
	}

	if (pathname === '/ingest' || pathname === '/ingest/') {
		return new URL(`https://us.i.posthog.com/${search}`);
	}

	if (pathname.startsWith('/ingest/')) {
		const path = pathname.slice('/ingest/'.length);
		return new URL(`https://us.i.posthog.com/${path}${search}`);
	}

	return null;
}

export default {
	async fetch(request: Request, _env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'GET' && url.pathname === '/') {
			return Response.json({ ok: true });
		}

		const upstreamUrl = resolveUpstreamUrl(url.pathname, url.search);
		if (!upstreamUrl) {
			return new Response('Not found', { status: 404 });
		}

		if (isKnownEuEeaGbCountry(request)) {
			return new Response(null, { status: 403 });
		}

		const headers = new Headers(request.headers);
		headers.set('host', upstreamUrl.hostname);

		return fetch(upstreamUrl, {
			method: request.method,
			headers,
			body:
				request.method !== 'GET' && request.method !== 'HEAD'
					? request.body
					: undefined,
		});
	},
} satisfies ExportedHandler<Env>;
