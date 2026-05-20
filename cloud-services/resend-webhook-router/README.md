# Resend webhook router (Cloudflare Worker)

Verifies Resend/Svix signatures, then forwards webhooks to both LangQuest Supabase `resend-webhook` functions. Setup follows [dotenvx with Cloudflare Workers](https://dotenvx.com/docs/platforms/cloudflare).

## Initial setup

```bash
cd cloud-services/resend-webhook-router
npm install
```

The Worker entrypoint loads dotenvx at startup:

```ts
import '@dotenvx/dotenvx/config';
// process.env.RESEND_WEBHOOK_SECRET
```

## Environment files

| File | Committed? | Purpose |
|------|------------|---------|
| `.env` | Yes (encrypted) | `RESEND_WEBHOOK_SECRET` |
| `.env.keys` | **Never** | Private decryption key |
| `.env.example` | Yes | Template for new setups |
| `.dev.vars` | No | Optional local `wrangler dev` override |

`RESEND_WEBHOOK_SECRET` must match `supabase/.env` and the Resend dashboard signing secret.

### First-time or rotate secret

```bash
# From repo root, read shared secret:
npx dotenvx get RESEND_WEBHOOK_SECRET -f supabase/.env

# Set on worker .env (creates/updates encryption):
cd cloud-services/resend-webhook-router
npx dotenvx set RESEND_WEBHOOK_SECRET "whsec_..." -f .env
npm run encrypt
```

## Local dev

```bash
npm run dev
```

Uses `dotenvx run -- wrangler dev` so `.env.keys` decrypts `.env` locally. POST to `http://localhost:8787` with Svix headers.

Alternatively, copy `.dev.vars.example` → `.dev.vars` and set `DOTENV_PRIVATE_KEY` from `.env.keys`, then run `npx wrangler dev`.

## Deploy

1. **Once per worker** — private key on Cloudflare:

```bash
npx wrangler secret put DOTENV_PRIVATE_KEY
# Paste DOTENV_PRIVATE_KEY from .env.keys (not committed)
```

2. Deploy (encrypted `.env` is bundled; Worker decrypts at runtime):

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

## Cloudflare dashboard

When creating the Worker in the dashboard, choose **Build System v3** if prompted (see dotenvx Cloudflare guide).
