# Resend webhook router (Cloudflare Worker)

Verifies Resend/Svix signatures, then forwards webhooks to both LangQuest Supabase `resend-webhook` functions. Secrets follow [Encrypt secrets in Cloudflare Workers](https://dotenvx.com/docs/secrets-in-cloudflare-workers).

## Initial setup

```bash
cd cloud-services/resend-webhook-router
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
// envx.RESEND_WEBHOOK_SECRET
```

## Environment files

| File | Committed? | Purpose |
|------|------------|---------|
| `.env.txt` | Yes (encrypted) | `RESEND_WEBHOOK_SECRET` (bundled in the Worker) |
| `.env.keys` | **Never** | Private decryption key |
| `.env.txt.example` | Yes | Template for new setups |

`RESEND_WEBHOOK_SECRET` must match `supabase/.env` and the Resend dashboard signing secret.

### First-time or rotate secret

```bash
# From repo root, read shared secret:
npx dotenvx get RESEND_WEBHOOK_SECRET -f supabase/.env

# Set on worker .env.txt (creates/updates encryption):
cd cloud-services/resend-webhook-router
npx dotenvx set RESEND_WEBHOOK_SECRET "whsec_..." -f .env.txt
npm run encrypt
```

## Local dev

```bash
npm run dev
```

Runs `wrangler dev` with `DOTENV_PRIVATE_KEY` from `.env.keys` via `dotenvx keypair`. POST to `http://localhost:8787` with Svix headers.

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

3. Resend Dashboard → Webhook URL:

`https://langquest-resend-webhook-router.<your-subdomain>.workers.dev`

## Non-secret config

`SUPABASE_WEBHOOK_TARGETS` is in `wrangler.jsonc` → `vars` (dev + production function URLs).

## Security

| Layer | Role |
|-------|------|
| **Worker** | Svix verify before forward |
| **Each Supabase `resend-webhook`** | Still verifies (URLs are public) |
