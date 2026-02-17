# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Start Dev Server**: `npm run dev` (Runs on http://localhost:3000)
- **Start Database/Redis**: `npm run db:up` (Docker Compose)
- **Stop Database/Redis**: `npm run db:down`
- **Check Containers**: `npm run db:ps`

### Build & Lint
- **Build**: `npm run build`
- **Start Production**: `npm start`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Full Check**: `npm run check` (Lint + Typecheck + Build)

### Database (Prisma)
- **Generate Client**: `npm run prisma:generate`
- **Migrate (Dev)**: `npm run prisma:migrate`
- **Push Schema (Proto)**: `npx prisma db push`
- **Seed Data**: `npm run prisma:seed`
- **Reset Database**: `npm run prisma:reset-seed`
- **Fix Drift**: `npm run prisma:fix-drift`

### Testing
- **Setup Test DB**: `./scripts/setup-test-db.sh` (REQUIRED before running tests)
- **Unit/Integration**: `npm test` (Watch mode)
- **Single Run**: `npm run test:run`
- **Coverage**: `npm run test:coverage`
- **E2E (Playwright)**: `npm run test:e2e`
- **E2E UI**: `npm run test:e2e:ui`

## Architecture: Modular Monolith

This project follows a **Modular Monolith** architecture.

### Structure
- **`app/`**: Next.js App Router (UI & API).
    - `api/`: Thin API controllers.
    - `(auth)/`, `admin/`, `(customer)/`: UI pages.
- **`modules/`**: Domain-specific modules (Business Logic).
    - Each module (e.g., `network`, `finance`) has:
        - `services/`: Business logic & validation.
        - `repositories/`: Database access (Prisma).
        - `index.ts`: Public API (exports services/repos).
- **`lib/`**: Shared utilities (Auth, Prisma client, global types).
- **`components/`**: Reusable React components.
- **`prisma/`**: Database schema and migrations.

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
- **State Management**: React Hooks / SWR (implied by Next.js context)
- **Validation**: Zod (used in API and Forms)

### MCP & Tools
- **MCP Usage**: ALWAYS run `mcp-cli info <server>/<tool>` before `mcp-cli call`.
- **Scripts**: Prefer using `tsx` for running TypeScript scripts (e.g., `npx tsx scripts/myscript.ts`).
- **Path Aliases**: Use `@/` for imports (e.g., `@/components`, `@/lib`, `@/modules`).
