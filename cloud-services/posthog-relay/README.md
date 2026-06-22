# PostHog relay (Cloudflare Worker)

Reverse-proxies LangQuest mobile analytics to PostHog Cloud US at `/ingest/*`. Blocks requests from known EU, EEA, and UK edge countries only; unknown geo is allowed through.

The mobile app sets `EXPO_PUBLIC_POSTHOG_HOST` to this Worker's `*.workers.dev` URL (no `langquest.org`).

## Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/` | `{ "ok": true }` |
| `*` | `/ingest/*` | Proxy to PostHog US, or `403` when `cf.country` is EU/EEA/GB |

## Setup

```bash
cd cloud-services/posthog-relay
npm install
```

## Deploy

```bash
npm run deploy
```

Set `EXPO_PUBLIC_POSTHOG_HOST` in EAS to the deployed Worker origin (no trailing slash), e.g. `https://langquest-posthog-relay.<subdomain>.workers.dev`. The app appends `/ingest`.
