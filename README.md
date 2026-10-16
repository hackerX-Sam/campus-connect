# CampusConnect

CampusConnect is a TypeScript monorepo for student communities, events, projects, and discussions. The repository contains a Next.js App Router client, an Express/Prisma API, shared Zod validation/types, and a PostgreSQL setup.

## Requirements

- Node.js 20 or newer and npm 10+
- PostgreSQL 15+ for local development

## Local setup

1. Copy `.env.example` to `.env` and set unique values for `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `NEXTAUTH_SECRET`. Both JWT secrets must be at least 32 characters and must be different.
2. Install packages and build the shared contracts:

   ```powershell
   npm install
   npm run build --workspace=packages/types
   ```

3. Start PostgreSQL locally.
4. Generate the Prisma client and apply the development migration:

   ```powershell
   npm run db:generate
   npm run db:migrate:dev
   npm run db:seed
   ```

   Starter records are stored in [`CampusConnectDataFiles/seed-data.json`](./CampusConnectDataFiles/seed-data.json) and seeded idempotently across users/profiles, communities/memberships, events/registrations, projects/teams, collaborations, discussions/comments, notifications, resources, tags, and moderation reports. Set `SEED_DEMO_PASSWORD` and `SEED_ADMIN_PASSWORD` to unique values before local seeding. For convenience only, local development defaults to `Student@123456` for student accounts and `Admin@123456` for the admin. Production seeding creates only the admin account and refuses to run without `SEED_ADMIN_PASSWORD`.
5. Start both applications:

   ```powershell
   npm run dev
   ```

The web app is at <http://localhost:3000>, the API at <http://localhost:3001>, the health check at <http://localhost:3001/health>, and Swagger UI at <http://localhost:3001/docs>.

## Production notes

For production, use managed PostgreSQL, unique secrets from a secret manager, TLS termination, backups, and an explicit `CORS_ORIGINS` allowlist. Never commit `.env`.

## Vercel frontend deployment

Import this repository into Vercel and set the project **Root Directory** to `apps/web`. The workspace's `vercel.json` installs from the monorepo root and builds the shared types before building Next.js. Public pages can run in read-only sample mode without a backend. To enable sign-in and persistent actions, set `NEXT_PUBLIC_API_URL` to the separately hosted API URL ending in `/api`, then configure that API's `CORS_ORIGINS` to allow the Vercel production and preview domains. Do not use `localhost` for a deployed API URL.

GitHub Actions validates the shared types, API, web app, tests, and production build.

## Vercel web deployment

Deploy the Next.js workspace from `apps/web` using Vercel's monorepo support. Set `NEXT_PUBLIC_API_URL` to the public base URL of the separately deployed Express API, ending in `/api`, and allow the Vercel production and preview origins in the API's `CORS_ORIGINS`. Do not set this value to `localhost` in Vercel. If it is omitted, public pages use the local sample dataset and authentication or protected API actions report that the API is not configured.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API and web development servers |
| `npm run build` | Build shared types, API, and web app |
| `npm run lint` | Lint API and web source |
| `npm run type-check` | Compile the API and type-check the web app |
| `npm test` | Run API security/integration tests and web component tests |
| `npm run test:e2e --workspace=apps/web` | Run browser flows against an already-running, seeded stack |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate:dev` | Create/apply a local development migration |
| `npm run db:migrate` | Apply checked-in migrations in deployment |
| `npm run db:seed` | Add local demo data |

The end-to-end flow tests create a unique account and sample community, event, and project. Run them only against a disposable test database.

## API usage

The API returns JSON envelopes shaped like `{ "success": true, "data": { ... } }`; failures use `{ "success": false, "error": "..." }`. List endpoints accept `page` (1-based) and `limit` (1–100), and supported resources accept search/filter query parameters. Authentication uses short-lived access JWTs and rotating, HttpOnly refresh-token cookies; browser requests must send credentials. Protected API clients may use `Authorization: Bearer <access-token>`.

Example:

```sh
curl "http://localhost:3001/api/communities?q=robotics&page=1&limit=10"
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.edu","password":"your-password"}' \
  -c cookies.txt
curl "http://localhost:3001/api/auth/me" -b cookies.txt
```

Swagger UI is served at `/docs`; the OpenAPI document is available at `/openapi.json`.

## Security and operations

- Passwords are hashed using bcrypt; JWT secrets fail closed in production.
- Refresh tokens are rotated and only their hashes are stored in database sessions.
- Helmet, configured CORS, rate limits, strict Zod input schemas, bounded request bodies, role checks, and ownership checks are enabled.
- Admin access requires the `ADMIN` role. Private community profiles/discussions are restricted to active members.
- Winston handles server error logging. Health checks intentionally avoid disclosing database details.
- Database models include explicit relation constraints and query indexes; Next.js uses route-level splitting and lazy-loaded avatars.

Optional SMTP and Redis values are reserved for integrations; the current product paths do not depend on either service.
