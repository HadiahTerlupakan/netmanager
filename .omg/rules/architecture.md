# Architectural Rules: Modular Monolith

## Core Principles
1. **Module Isolation:** All core business logic resides in `modules/`. Each module must act as an independent bounded context.
2. **No Direct Cross-Module Database Access:** A module's Repository (`modules/*/repositories/*`) MUST NOT perform direct SQL JOINs or Prisma relations (like `include`) into tables owned by another module. 
3. **Service-to-Service Communication:** If Module A needs data from Module B, Module A's Service must call Module B's Service. Data aggregation happens at the application/service layer, not the database layer.
4. **Thin Controllers:** API Routes (`app/api/*`) must remain thin. They are only responsible for request parsing, authorization (via `auth: true` or `authorize` middleware), and passing data to the appropriate module Service.
5. **Database Layer:** Prisma Client is the ORM. Query logic must be encapsulated within the Repository layer inside each module. Avoid deep nested `include` statements if specific `select` statements can fulfill the requirement efficiently.

## Import Boundary Contract (Executable)

1. **Public API Only (Cross-Module):**
   - Allowed lintas modul: `@/modules/<module>` (via `modules/<module>/index.ts`).
   - Forbidden lintas modul: `@/modules/<module>/services/**`, `@/modules/<module>/repositories/**`, `@/modules/<module>/**`.
   - Larangan deep import berlaku juga untuk `import type` dan dynamic `await import(...)`.
2. **UI Boundary (`app/**/*.tsx`):**
   - UI tidak boleh import repository/service modul secara langsung.
   - UI tidak boleh akses `@/lib/prisma*`.
   - UI konsumsi data via API boundary.
3. **API Route Boundary (`app/api/**/*.ts`):**
   - Route tidak boleh import repository modul secara langsung.
   - Route mengutamakan import module public API (`@/modules/<module>`).
   - Route harus meminimalkan akses langsung `@/lib/prisma*`; orchestration dipindah ke service/repository domain.
4. **Cross-Module Settings/Config Access:**
   - Modul lain wajib menggunakan service/facade publik untuk membaca setting modul target, bukan repository internal.

## Enforcement Strategy

- Guardrail lint dijalankan via `eslint.config.mjs` (`no-restricted-imports`) dalam mode `warn` untuk rollout bertahap.
- Setelah backlog pelanggaran kritis turun, severity dinaikkan menjadi `error`.
- Setiap module yang dibutuhkan lintas domain wajib mengekspos facade/use-case melalui `modules/<module>/index.ts` sebelum dipakai consumer lain.

## Security Constraints
- **IDOR Prevention:** All API endpoints dealing with specific IDs (`[id]/route.ts`) MUST verify ownership or tenancy (`siteId`, `tenantId`, `userId`) against the current session context before returning or modifying data.
- **No Hardcoded Secrets:** Credentials and API keys must use environment variables (`process.env.*`) and must never be hardcoded in application code or shell scripts.
