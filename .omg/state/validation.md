# Validation Commands

## Full Health Check
```bash
npm run check
```
Runs linting, type-checking, and a full production build.

## Individual Checks
- **Linting**: `npm run lint` (ESLint)
- **Type-checking**: `npm run typecheck` (tsc --noEmit)
- **Unit Tests**: `npm run test` (Vitest)
- **E2E Tests**: `npm run test:e2e` (Playwright)

## Database Operations
- **Generate Clients**: `npm run prisma:generate`
- **Push Schema**: `npm run prisma:push-all`
- **Migrate Dev**: `npm run prisma:migrate`
- **Seed Data**: `npm run prisma:seed`

## Development Constraints
- **Strict Typing**: All new code must pass `npm run typecheck`.
- **Tenant Isolation**: Every query must include `tenantId` where applicable.
- **Modular Monolith**: Logic should reside in `modules/`, with `app/api` acting as a thin entry layer.
- **Language**: All communication/comments in Bahasa Indonesia, code in English.
