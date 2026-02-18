# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Start Dev Server**: `npm run dev` (Custom server with tsx watch on http://localhost:3000)
- **Start Database/Redis**: `npm run db:up` (Docker Compose)
- **Stop Database/Redis**: `npm run db:down`
- **Check Containers**: `npm run db:ps`

### Build & Lint
- **Build**: `npm run build`
- **Start Production**: `npm start` (Custom server with NODE_ENV=production)
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Full Check**: `npm run check` (Lint + Typecheck + Build)

### Database (Prisma)
- **Generate Client**: `npm run prisma:generate`
- **Migrate (Dev)**: `npm run prisma:migrate`
- **Migrate (Deploy)**: `npm run prisma:migrate-deploy`
- **Push Schema (Proto)**: `npx prisma db push`
- **Setup Database**: `npm run prisma:setup` (Generate + Migrate + Seed)
- **Seed Data**: `npm run prisma:seed`
- **Reset Database**: `npm run prisma:reset` (Force reset)
- **Reset & Seed**: `npm run prisma:reset-seed`
- **Fix Drift**: `npm run prisma:fix-drift`

### Testing
- **Setup Test DB**: `./scripts/setup-test-db.sh` (REQUIRED before running tests)
- **Unit/Integration**: `npm test` (Vitest watch mode)
- **Single Run**: `npm run test:run`
- **Coverage**: `npm run test:coverage`
- **E2E (Playwright)**: `npm run test:e2e`
- **E2E UI**: `npm run test:e2e:ui`

## Architecture: Modular Monolith

This project follows a **Modular Monolith** architecture.

### Structure
- **`app/`**: Next.js App Router (UI & API).
    - `api/`: Thin API controllers.
    - `(auth)/`: Auth pages (login, register).
    - `(customer)/`: Customer portal pages.
    - `admin/`: Admin portal pages.
    - `karyawan/`: Employee portal pages.
    - `components/`, `contexts/`, `styles/`: App-level shared resources.
- **`modules/`**: Domain-specific modules (Business Logic).
    - **Available modules**: admin, app-version, attendance, chat, coupons, finance, integrations, inventory, map, marketing, network, notification, overtime, pelanggan, procurement, registration, roles, salary, shift, users, work-order
    - Each module (e.g., `network`, `finance`) has:
        - `services/`: Business logic & validation.
        - `repositories/`: Database access (Prisma).
        - `index.ts`: Public API (exports services/repos).
- **`lib/`**: Shared utilities (Auth, Prisma client, global types).
- **`components/`**: Reusable React components.
- **`prisma/`**: Database schema and migrations.
- **`server.ts`**: Custom Express/Node server with Socket.IO support.

### Core Principles
1.  **Layered Architecture**: UI -> API (Thin) -> Service -> Repository -> Database.
2.  **Module Encapsulation**: Modules should only communicate via their public API (`index.ts`).
3.  **No Cross-Module DB Access**: A module should not import another module's repository directly. Use the Service instead.
4.  **Thin API Routes**: API routes should parse requests and call Services. They should not contain business logic.
5.  **Background Synchronization**: Heavy external synchronization tasks (e.g., updating multiple MikroTik profiles) should be executed in the background (fire-and-forget) to ensure fast API response times.
6.  **Resource Cleanup**: When moving resources between external entities (e.g., changing MikroTik routers), explicitly clean up the resource on the old entity to prevent orphaned configurations.

## Development Guidelines

- **Package Manager**: npm
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache/Queue**: Redis (via ioredis)
- **Real-time**: Socket.IO with Redis adapter
- **State Management**: React Hooks / SWR
- **Validation**: Zod (used in API and Forms)
- **Testing**: Vitest (unit/integration), Playwright (E2E)

### Subdomain Routing
The application supports subdomain-based routing:
- **Admin Portal**: `admin.localhost:3000` (development) / `admin.domain.com` (production)
- **Customer Portal**: `pelanggan.localhost:3000` (development) / `pelanggan.domain.com` (production)

### External Integrations
- **MikroTik RouterOS**: Network device management via node-routeros-v2
- **FreeRADIUS**: PPPoE authentication (ports 1812/UDP, 1813/UDP)

### MCP & Tools
- **MCP Usage**: ALWAYS run `mcp-cli info <server>/<tool>` before `mcp-cli call`.
- **Scripts**: Prefer using `tsx` for running TypeScript scripts (e.g., `npx tsx scripts/myscript.ts`).
- **Path Aliases**: Use `@/` for imports (e.g., `@/components`, `@/lib`, `@/modules`).
