import dotenvx from '@dotenvx/dotenvx';
import { Webhook } from 'svix';

import envSrc from '../.env.txt';

const config = dotenvx.config({
	envs: [{ type: 'env', value: envSrc, privateKeyName: 'DOTENV_PRIVATE_KEY' }],
});
const envx = config.parsed;

export interface Env {
	/** JSON array of Supabase edge function URLs */
	SUPABASE_WEBHOOK_TARGETS: string;
}

interface ForwardResult {
	url: string;
	status: number;
	ok: boolean;
}

function parseTargets(raw: string): string[] {
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error('SUPABASE_WEBHOOK_TARGETS must be a non-empty JSON array');
	}
	return parsed.map((entry, index) => {
		if (typeof entry !== 'string' || entry.length === 0) {
			throw new Error(`SUPABASE_WEBHOOK_TARGETS[${index}] must be a non-empty string`);
		}
		return entry;
	});
}

function verifySvixSignature(
	rawBody: string,
	request: Request,
	secret: string,
): { ok: true } | { ok: false; status: number; error: string } {
	const svixId = request.headers.get('svix-id');
	const svixTimestamp = request.headers.get('svix-timestamp');
	const svixSignature = request.headers.get('svix-signature');

	if (!svixId || !svixTimestamp || !svixSignature) {
		return { ok: false, status: 400, error: 'Missing Svix webhook headers' };
	}

	try {
		const wh = new Webhook(secret);
		wh.verify(rawBody, {
			'svix-id': svixId,
			'svix-timestamp': svixTimestamp,
			'svix-signature': svixSignature,
		});
		return { ok: true };
	} catch (error) {
		console.error('[resend-webhook-router] Svix verification failed:', error);
		return { ok: false, status: 401, error: 'Invalid signature' };
	}
}

function forwardHeaders(request: Request): Headers {
	const headers = new Headers();
	for (const name of ['svix-id', 'svix-timestamp', 'svix-signature', 'content-type']) {
		const value = request.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}
	if (!headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}
	return headers;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
			return Response.json({ ok: true });
		}

		if (request.method !== 'POST') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}

		const webhookSecret = envx?.RESEND_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error('[resend-webhook-router] RESEND_WEBHOOK_SECRET is not set');
			return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
		}

		let targets: string[];
		try {
			targets = parseTargets(env.SUPABASE_WEBHOOK_TARGETS);
		} catch (error) {
			console.error('[resend-webhook-router] Invalid targets config:', error);
			return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
		}

		const body = await request.text();
		const verification = verifySvixSignature(body, request, webhookSecret);
		if (!verification.ok) {
			return Response.json({ error: verification.error }, { status: verification.status });
		}

		const headers = forwardHeaders(request);

		const results: ForwardResult[] = await Promise.all(
			targets.map(async (url) => {
				const response = await fetch(url, {
					method: 'POST',
					headers,
					body,
				});
				return { url, status: response.status, ok: response.ok };
			}),
		);

		const failed = results.filter((result) => !result.ok);
		if (failed.length > 0) {
			console.error('[resend-webhook-router] Forward failures:', failed);
			return Response.json(
				{
					error: 'One or more Supabase targets failed',
					results,
				},
				{ status: 502 },
			);
		}

		return Response.json({ success: true, results });
	},
} satisfies ExportedHandler<Env>;
