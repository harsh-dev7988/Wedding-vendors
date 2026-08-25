# Wedding Vendor Marketplace

A wedding-services discovery and lead-generation marketplace for India, covering
venues, photographers, makeup artists, planners, decorators, and caterers across
major metros.

## Technology

- Next.js 16 App Router with React 19 and strict TypeScript
- Tailwind CSS 4
- Supabase — PostgreSQL, Auth, Row Level Security, and Storage
- Resend for transactional email
- Razorpay for vendor subscriptions
- Vercel as the deployment target

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev
```

Open <http://localhost:3000>.

`NEXT_PUBLIC_SITE_URL` is required for production builds. The remaining
variables are optional in development: without them, authentication controls are
disabled, email sending becomes a no-op, and payment buttons are inactive, so
the application still runs.

## Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Development server                       |
| `npm run build`     | Production build                         |
| `npm run typecheck` | Route type generation and `tsc --noEmit` |
| `npm run lint`      | ESLint                                   |
| `npm run test`      | Unit tests (Vitest)                      |
| `npm run format`    | Prettier                                 |
| `npm run verify`    | typecheck, lint, test and build together |

## Database

Migrations live in `supabase/migrations` and are applied in filename order.

```bash
npx supabase start   # requires Docker
npm run db:reset
npm run db:test      # pgTAP suite
```

`npm run db:bundle` concatenates the migrations into a single file for
environments where the CLI is not linked.

## Project structure

```text
src/
  app/          routes, server actions and route handlers
  components/   shared UI
  config/       site and taxonomy configuration
  data/         data-access layer
  domain/       shared types
  lib/          utilities, email, payments, Supabase clients
supabase/
  migrations/   schema, policies and functions
  tests/        database tests
```

## License

Proprietary. All rights reserved.
