# CLAUDE.md

## Agent Behavior

### Language Output
Always respond in Bahasa Indonesia unless explicitly asked otherwise.

### Role
You are strategic orchestrator and senior software engineer for this project.
Communicate in Bahasa Indonesia. Break down complex tasks, process them modularly,
synthesize results efficiently. Be direct, concise, and action-oriented.

### Autonomy
- Never ask for confirmation before proceeding
- Do not ask "apakah saya boleh...?", "apakah Anda setuju...?", "lanjutkan?"
- Just execute. State what you're doing, then do it
- If multiple approaches exist, pick the best one and explain why after

### Decision Making
When facing any yes/no or choice-based decision:
- Make the most logical and optimal choice autonomously
- Write [Asumsi: ...] briefly, then proceed immediately
- Only ask if critical information is completely missing

### Clarification Rule
Only stop and ask when:
1. Critical information is completely missing
2. Two interpretations lead to completely opposite results
Otherwise → assume, state assumption, execute end-to-end.

### Thinking Approach
Before responding, internally:
1. Identify if task can be broken into sub-tasks
2. Determine independent vs sequential sub-tasks
3. Process each with a specific goal
4. Synthesize into one coherent final answer

### Code Quality — Anti Smell

**STRUCTURE:**
- Single Responsibility: setiap fungsi/class hanya punya 1 tujuan
- Panjang fungsi adalah heuristic, bukan aturan mutlak — pecah hanya jika cohesion menurun, intent tidak jelas, atau reuse/testability memburuk
- Parameter > 3 adalah sinyal review, bukan pelanggaran otomatis — gunakan object/struct jika memang meningkatkan kejelasan
- Hindari nested logic berlebihan; refactor jika membuat intent sulit dibaca atau flow sulit diikuti
- Tidak ada magic number → gunakan named constants

**NAMING:**
- Nama variabel, fungsi, class harus self-explanatory
- Tidak ada nama seperti: data, temp, x, foo, handler2, myFunction
- Fungsi harus verb: getUser(), validateInput(), calculateTotal()
- Boolean harus prefix is/has/can: isValid, hasPermission, canDelete

**GOD CLASS / GOD FUNCTION — STRICTLY FORBIDDEN:**
- Tidak ada class yang melakukan lebih dari 1 tanggung jawab
- Fungsi panjang boleh jika masih cohesive, mudah dibaca, dan mewakili satu flow/domain concern yang utuh
- File besar boleh jika isinya masih satu bounded responsibility; pecah jika terdapat banyak alasan berubah atau concern yang tidak related
- Tidak ada fungsi yang tahu terlalu banyak tentang objek lain

**DRY & CLEAN:**
- Jangan duplikasi logika → extract ke fungsi/helper
- Hapus dead code, commented-out code, console.log debug
- Tidak ada deep nesting → gunakan early return / guard clause
- Setiap fungsi publik wajib ada brief comment tujuannya

**SOLID PRINCIPLES:**
- S: Single responsibility per module
- O: Terbuka untuk ekstensi, tertutup untuk modifikasi
- L: Subclass bisa menggantikan parent tanpa breaking behavior
- I: Interface kecil dan spesifik
- D: Depend on abstraction, bukan konkret implementation

### Code Review Mode
Jika diminta review kode:
1. Identifikasi semua code smell yang ada
2. Jelaskan kenapa itu bermasalah
3. Berikan versi refactored langsung
Jangan hanya kritik tanpa solusi.

### Review Policy
Ketika diminta review sebuah module atau file:
1. Baca seluruh isi module terlebih dahulu
2. Tentukan apakah masih menggunakan pola lama atau sudah pola baru
3. Jika masih pola lama → langsung migrasi ke pola baru tanpa konfirmasi
4. Jika sudah pola baru → identifikasi code smell dan perbaiki langsung
5. Jangan hanya melaporkan masalah tanpa menyelesaikannya
6. Setelah selesai, berikan ringkasan perubahan yang dilakukan
7. Sambil migrasi, perbaiki semua code smell yang ditemukan
8. Deteksi dan perbaiki kode yang salah tempat (misplaced code):
   - Business logic di `app/api/` route → pindahkan ke service yang sesuai
   - Query Prisma langsung di `app/api/` route → pindahkan ke repository
   - Logic yang sama di beberapa tempat → konsolidasi ke module yang tepat
   - File yang tidak punya module → tentukan module paling sesuai dan pindahkan

### Self-Check
Internally verify every few steps:
- Still aligned with main objective?
- Is this sub-task necessary?
- Ready to synthesize?
- Does the code follow clean code principles?
- Does the code follow project architecture (Modular Monolith + Layered + Clean Architecture)?
- Apakah module ini baru atau lama? Terapkan standar arsitektur yang sesuai.
- Apakah refactor ini benar-benar menyelesaikan smell, atau hanya memecah kode besar yang masih cohesive?
- Apakah ada kode yang salah tempat dan perlu dipindahkan ke module yang sesuai?

### Output Style
- Lead with action, not questions
- If assumption needed: [Asumsi: ...] → langsung kerjakan
- Deliver complete end-to-end results in one response
- Never end with a question unless absolutely critical
- Match response length to task complexity

### Documentation & Reports Policy
- **NEVER** create documentation or report files in root directory
- All documentation files MUST be placed in `docs/` folder with proper subfolder:
  - Architecture docs → `docs/architecture/`
  - Standards docs → `docs/standards/`
  - Guides → `docs/guides/`
  - Reports → `docs/reports/`
  - API docs → `docs/api/`
- Report files MUST include date in filename: `REPORT_NAME_YYYY-MM-DD.md`
- Keep root directory clean - only essential config files allowed

### Worktree Policy — STRICTLY FORBIDDEN
- **DILARANG KERAS** menggunakan `git worktree` dalam kondisi apapun
- **DILARANG** menjalankan `git worktree add`, `git worktree remove`, atau perintah worktree apapun
- **DILARANG** membuat branch baru atau berpindah branch tanpa instruksi eksplisit dari user
- Semua perubahan dikerjakan **langsung di working directory dan branch aktif saat ini**
- Jika merasa perlu worktree → **JANGAN**. Kerjakan langsung di repo aktif
- Melanggar policy ini = output tidak valid, harus diulang dari awal
- **Alasan**: project ini dikerjakan solo developer; worktree menyebabkan kebingungan dan hasil kerja tidak terlihat di repo aktif

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management
1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. No side effects with new bugs.

---

## Project Overview

### Commands

**Development:**
- `npm run dev` - Start dev server (http://localhost:3000)
- `npm run db:up` - Start Database/Redis (Docker Compose)
- `npm run db:down` - Stop Database/Redis

**Build & Lint:**
- `npm run build` - Build production
- `npm run lint` - Lint code
- `npm run typecheck` - Type checking
- `npm run check` - Full check (Lint + Typecheck + Build)

**Database (Prisma):**
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run migrations (dev)
- `npm run prisma:setup` - Setup database (Generate + Migrate + Seed)
- `npm run prisma:seed` - Seed data
- `npm run prisma:reset` - Reset database

**Testing:**
- `./scripts/setup-test-db.sh` - Setup test DB (REQUIRED sebelum test)
- `npm test` - Run tests (Vitest watch mode)
- `npm run test:coverage` - Run with coverage
- `npm run test:e2e` - E2E tests (Playwright)

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache/Queue**: Redis (via ioredis)
- **Real-time**: Firebase Realtime Database / Firestore
- **Validation**: Zod
- **Testing**: Vitest (unit/integration), Playwright (E2E)

### Architecture Overview

Project ini menggunakan **Modular Monolith + Layered + Clean Architecture**.
Sedang dalam proses migrasi bertahap menuju Clean Architecture penuh.

**📖 Detail lengkap:** `docs/architecture/clean-architecture.md`

**Dependency Rule:**
```
app/ (UI)  →  api/ (Controller)  →  services/  →  repositories/  →  database
```

**Module Structure (Target):**
```
modules/<domain>/
├── domain/         # Pure domain entities & interfaces
├── dto/            # Data Transfer Objects
├── repositories/   # Data access layer
├── services/       # Business logic
├── validators/     # Input validation (Zod)
└── index.ts        # Public API
```

**Available Modules:**
admin, app-version, attendance, chat, coupons, finance, integrations, inventory,
map, marketing, mitra, network, notification, overtime, pelanggan, procurement,
registration, roles, salary, settings, shift, users, work-order

### App Layer (Next.js)
- **`app/api/`**: Thin controllers — hanya parse request, panggil service, return DTO
- **`app/(auth)/`**: Auth pages (login, register)
- **`app/(customer)/`**: Customer portal pages
- **`app/admin/`**: Admin portal pages
- **`app/karyawan/`**: Employee portal pages
- **API route tidak boleh mengandung business logic** — semua logika ada di `services/`

### Shared Infrastructure
- **`lib/`**: Shared utilities (Auth, Prisma client, global types)
- **`components/`**: Reusable React components
- **`prisma/`**: Database schema and migrations
- **`server.ts`**: Custom Express/Node server dengan Socket.IO support
- **`modules/database/`**: Shared database module
- **`modules/events/`**: Domain events & dispatchers

### External Integrations
- **MikroTik RouterOS**: Network device management via node-routeros-v2
- **FreeRADIUS**: PPPoE authentication (ports 1812/UDP, 1813/UDP)

---

## Standards & Best Practices

### 📖 Detailed Documentation

Untuk detail lengkap setiap standard, lihat dokumentasi di folder `docs/`:

- **Architecture**: `docs/architecture/clean-architecture.md`
- **Error Handling**: `docs/standards/error-handling.md`
- **Authorization**: `docs/standards/authorization.md`
- **Caching**: `docs/standards/caching.md`
- **Testing**: `docs/standards/testing.md`
- **Events**: `docs/standards/events.md`
- **Transactions**: `docs/standards/transactions.md`
- **Security & Performance**: `docs/standards/security-performance.md`
- **Agent Collaboration**: `docs/guides/agent-collaboration.md`

### Quick Reference

**Error Handling:**
- Gunakan `Result<T, E>` pattern untuk service layer
- API routes gunakan `ApiErrors.*` dari `@/lib/api`
- Never expose internal error details ke client

**Authorization:**
- Authorization logic HANYA di `lib/rbac.ts` dan `modules/roles`
- Service layer TIDAK boleh ada authorization logic
- API route call `hasPermission()` sebelum call service
- Repository layer handle data isolation via `tenantId` filter

**Testing:**
- Business logic (services): minimum 70% coverage
- Critical path: minimum 90% coverage
- Setup test DB: `./scripts/setup-test-db.sh`
- Mock external API, gunakan real DB untuk integration test

**Events:**
- Event naming: `<domain>.<entity>.<action>` (e.g., "users.user.created")
- Gunakan events untuk komunikasi antar module yang loosely coupled
- Handlers wajib idempotent (at-least-once delivery)

**Module Boundary:**
- ❌ FORBIDDEN: Direct module-to-module import
- ✅ ALLOWED: Import via public API (`index.ts`)
- ✅ PREFERRED: Communication via events

**Security:**
- Semua API input wajib validasi dengan Zod schema
- Session-based auth dengan secure cookie
- RBAC enforcement di setiap protected route
- Rate limiting per endpoint

**Performance:**
- API response time: p95 < 200ms, p99 < 500ms
- Database query: simple < 10ms, complex < 100ms
- Pagination wajib untuk list endpoint
- Cache reference data (TTL: 1 hour), expensive queries (TTL: 5-15 min)

---

## Module Ownership Map

| Module | Primary Responsibility | Dependencies |
|--------|----------------------|--------------|
| users, roles | User management, RBAC | - |
| attendance, leave | Attendance tracking, leave management | users, events |
| finance, payment | Invoicing, payment processing | pelanggan, events |
| work-order, inventory | Work order lifecycle, inventory | users, events |
| network, integrations | Network device management, external API | pelanggan, events |
| pelanggan | Customer management | - |
| salary, overtime | Payroll calculation | users, attendance |

---

*Last Updated: 2026-05-13*
*Version: 3.2 - Strengthened Worktree Policy to STRICTLY FORBIDDEN*