# Tribune

ERC-792-compatible AI arbitrator for onchain disputes.

This repository is a Turborepo monorepo containing the Tribune web app, API, and shared packages. **This is the boilerplate scaffold only — none of Tribune's arbitration logic is implemented yet.**

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** (for the local Postgres database)

## Quick start

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

That brings up:

- Web app at <http://localhost:3000>
- API at <http://localhost:3001> (Swagger docs at <http://localhost:3001/api/docs>, health at <http://localhost:3001/health>)
- Postgres on `localhost:5432` (db `tribune`, user `tribune`, password `tribune` — **dev only**)

Copy the env template before the first run if you have not already:

```bash
cp .env.example .env
```

## Project structure

```
tribune/
├── apps/
│   ├── web/                  Next.js 15 + React 19 + Tailwind v4
│   └── api/                  NestJS 11 + Prisma + PostgreSQL
├── packages/
│   ├── ui/                   Shared React components (shadcn/ui style)
│   ├── types/                Shared Zod schemas + inferred TS types
│   ├── eslint-config/        Shared ESLint flat configs
│   └── tsconfig/             Shared tsconfig presets
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
└── .env.example
```

## Common commands

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Run web + API in watch mode                         |
| `pnpm build`       | Build every workspace package                       |
| `pnpm lint`        | Lint every workspace                                |
| `pnpm type-check`  | Type-check every workspace                          |
| `pnpm test`        | Run every workspace's tests                         |
| `pnpm format`      | Prettier write across the repo                      |
| `pnpm db:generate` | Generate the Prisma client                          |
| `pnpm db:migrate`  | Run `prisma migrate dev` against the local Postgres |
| `pnpm clean`       | Remove build outputs and `node_modules`             |

Per-app commands run via Turbo's filter:

```bash
pnpm --filter @tribune/web dev
pnpm --filter @tribune/api dev
```

## Environment variables

A single `.env.example` at the root documents every variable. Each app reads only the ones it needs.

| Variable                               | Used by | Notes                                 |
| -------------------------------------- | ------- | ------------------------------------- |
| `DATABASE_URL`                         | api     | Postgres connection string            |
| `API_PORT`                             | api     | Default `3001`                        |
| `WEB_ORIGIN`                           | api     | CORS allow-origin                     |
| `LOG_LEVEL`                            | api     | Pino log level (default `info`)       |
| `WEB_PORT`                             | web     | Default `3000`                        |
| `NEXT_PUBLIC_API_URL`                  | web     | API base URL                          |
| `NEXT_PUBLIC_OG_CHAIN_ID`              | web     | 0G Chain id (testnet `16601`)         |
| `NEXT_PUBLIC_OG_RPC_URL`               | web     | 0G RPC endpoint                       |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | web     | RainbowKit / WalletConnect project id |

## License

See `LICENSE`.
