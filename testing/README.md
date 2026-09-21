# Testing

Runners and helpers live here. Specs stay with the tools that execute them.

```bash
npm run test:ci
npm run test:rls
npm run maestro:local:preview
```

- **Jest** — `npm run test:ci`. Unit tests sit next to the module they pin (`features/**/__tests__/`, `store/__tests__/`, `hooks/__tests__/`). Setup is [`jest.setup.ts`](jest.setup.ts); config stays at the repo root (`jest.config.js`).
- **pgTAP** — `npm run test:rls`. RLS SQL is in [`supabase/tests/`](../supabase/tests/). Needs `npm run env:start`.
- **Maestro** — [`maestro-local.ts`](maestro-local.ts) drives device flows. Pick **one** target per run: `npm run maestro:local:preview` (preferred; `com.etengenesis.langquest.preview` after `npm run android:preview` or `ios:preview`) or `npm run maestro:local` (development client + Metro). They cover the same suite against different installed apps, so do not run both. Flows, seeds, and device notes are in [`.maestro/`](../.maestro/README.md). Failure dumps stay in `~/.maestro/tests/`.
- **Client migrations (out of date) ** — device DB swap scripts in [`client-migrations/`](client-migrations/README.md).
