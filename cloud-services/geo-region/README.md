# Geo region lookup (Cloudflare Worker)

Returns the caller's ISO 3166-1 alpha-2 country code from Cloudflare edge geolocation (`request.cf.country`). Used by the LangQuest mobile app to gate PostHog analytics for EU, EEA, and UK users alongside device-locale detection.

**No retention.** The Worker does not log requests, persist IPs, or write to storage. Observability is disabled in `wrangler.jsonc`. The response contains only `countryCode` and `isEuEeaGb` — never the IP address.

Secrets follow [Encrypt secrets in Cloudflare Workers](https://dotenvx.com/docs/secrets-in-cloudflare-workers), same pattern as `resend-webhook-router`.

## Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/` | `{ "ok": true }` |
| `GET` | `/country` | `{ "countryCode": "DE" \| null, "isEuEeaGb": boolean }` (authenticated clients only) |
| `OPTIONS` | any | CORS preflight |

## Setup

```bash
cd cloud-services/geo-region
npm install
```

The Worker bundles encrypted `.env.txt` and decrypts at startup:

```ts
import envSrc from '../.env.txt';
import dotenvx from '@dotenvx/dotenvx';

const config = dotenvx.config({
  envs: [{ type: 'env', value: envSrc, privateKeyName: 'DOTENV_PRIVATE_KEY' }],
});
const envx = config.parsed;
// envx.GEO_REGION_PUBLIC_API_KEY
```

## Environment files

| File | Committed? | Purpose |
|------|------------|---------|
| `.env.txt` | Yes (encrypted) | `GEO_REGION_PUBLIC_API_KEY` (bundled in the Worker) |
| `.env.keys` | **Never** | Private decryption key |
| `.env.txt.example` | Yes | Template for new setups |

### First-time or rotate key

```bash
cd cloud-services/geo-region
npx dotenvx set GEO_REGION_PUBLIC_API_KEY "<new-key>" -f .env.txt
npm run encrypt
```

After rotating, update the matching app build secret in EAS and redeploy the Worker.

## Local dev

```bash
npm run dev
```

Runs `wrangler dev` with `DOTENV_PRIVATE_KEY` from `.env.keys` via `dotenvx keypair`.

`request.cf.country` is usually absent in local `wrangler dev`. The Worker returns `{ "countryCode": null, "isEuEeaGb": false }`; the app does not block on unknown IP country.

## Deploy

1. **Once per worker** — private key on Cloudflare:

```bash
npx wrangler secret put DOTENV_PRIVATE_KEY
# Paste DOTENV_PRIVATE_KEY from .env.keys (not committed)
```

2. Deploy (encrypted `.env.txt` is bundled; Worker decrypts at runtime):

```bash
npm run deploy
```

3. Point the mobile app at the deployed Worker URL via EAS environment variables (see `.env.local.example` in the app repo).

## Privacy

| Property | Behavior |
|----------|----------|
| IP storage | None |
| Request logs | Disabled |
| Response | Country code only |
| Lawful basis | Legitimate interest — regional analytics restriction (document in RoPA) |

Cloudflare processes the IP at the edge to populate `cf.country`. Frontier R&D does not receive or store the IP in application code.
