---
description: Mandatory development standards and rules to prevent common errors (Schema, Linting, Architecture).
---

# NetManager Development Standards

This workflow defines the MANDATORY rules that must be followed for all development tasks in the NetManager project.

## 1. Database & Schema Workflow

- **Migration is Mandatory**: Any change to `prisma/schema.prisma` MUST be followed by:
  1. `npx prisma migrate dev --name <descriptive_name>` (Local/Dev)
  2. `npx prisma generate`
- **Seed Script Updates**: If you add a new model that requires initial data (like `MapSettings`), you MUST update `prisma/seed.ts`.
  - **Type Verification**: Check `prisma/schema.prisma` for ID types (e.g., `Int` vs `String`) before writing seed data.
  - **Upsert Strategy**: Always use `upsert` in seeding to prevent duplicate key errors on re-runs.

## 2. Code Quality & Linting (Strict Enforcement)

This project uses `eslint.config.mjs` with strict TypeScript rules. **Violations will break the build.**

- **Unused Variables (`@typescript-eslint/no-unused-vars`)**:
  - **Rule**: Variables defined but not used are FORBIDDEN.
  - **Fix**:
    - **Remove** the variable if it's truly unused.
    - **Prefix with `_`** if it's required by a function signature (e.g., `_req`, `_res`, `_type`).
    - **Pattern**: The config explicitly respects `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, and `caughtErrorsIgnorePattern: "^_"`.
- **No Explicit Any (`@typescript-eslint/no-explicit-any`)**:
  - **Rule**: Usage of `any` is discouraged and warns.
  - **Fix**: Use proper interfaces (e.g., imported from `@prisma/client` or defined DTOs).
- **React Hooks (`react-hooks/exhaustive-deps`)**:
  - **Rule**: `useEffect` dependencies must be exhaustive.
  - **Fix**: Include all dependencies or validly exclude them if intended (comment reasoning).
- **Mandatory Check**:
  - run `npm run lint` to catch these errors BEFORE finalizing any task.

## 3. Architecture: Modular Monolith

- **Strict Separation of Concerns**:
  - **Routes (`app/api/...`)**: Handle Request/Response wrapping, Auth checks (`withAuth`), and validation.
  - **Services (`lib/services/...`)**: distinct business logic.
  - **Repositories (`lib/repositories/...`)**: Database interactions using Prisma.
- **DTOs**: Use proper input types. For Prisma relations, prefer `UncheckedCreateInput` when passing scalar IDs (like `source`, `target` instead of nested `connect`).

## 4. Specific Implementation Guides

### Maps (Leaflet + Next.js)

- **SSR False**: Leaflet components must be imported dynamically with `{ ssr: false }`.
- **HTTPS Tiles**: Always use HTTPS for tile layer URLs to prevent Mixed Content warnings.
- **Icon Fix**: Default Leaflet icons require a manual fix in `useEffect` or global scope (as seen in `NetworkMap.tsx`).

## 5. Error Handling

- Use the standardized `apiSuccess` and `apiError` wrappers from `lib/api-response.ts`.
- Do not create ad-hoc error responses.
