# Directory Structure & File Organization

**Last Updated:** 2026-08-09

---

## Root Directory Overview

```
netmanager/
├── app/                    # Next.js App Router (UI & API routes)
├── components/             # Reusable React components
├── lib/                    # Shared utilities, services, middleware
├── modules/                # Domain modules (business logic)
├── prisma/                 # Database schemas, migrations, seeds
├── tests/                  # Test files (Vitest, Playwright)
├── public/                 # Static assets
├── docs/                   # Documentation
├── k8s/                    # Kubernetes manifests
├── scripts/                # Utility scripts
├── cron/                   # Cron worker Docker setup
├── radius/                 # FreeRADIUS Docker setup
├── freeradius-config/      # RADIUS configuration templates
├── server.ts               # Custom Node.js server entry
├── worker.ts               # Background worker entry
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies & scripts
└── tsconfig.json           # TypeScript configuration
```

---

## `/app` — Next.js App Router

### Structure
```
app/
├── (auth)/                 # Auth-only routes (login pages)
│   ├── (customer)/        # Customer portal auth
│   ├── admin/login/       # Admin portal auth
│   └── karyawan/login/    # Employee portal auth
├── (customer)/             # Customer portal pages
│   ├── dashboard/
│   ├── tagihan/
│   ├── koneksi/
│   ├── dukungan/
│   └── profil/
├── admin/                  # Admin portal pages
│   ├── pelanggan/
│   ├── finance/
│   ├── akuntansi/
│   ├── attendance/
│   ├── inventory/
│   ├── work-order/
│   ├── map/
│   └── [50+ subdirectories]
├── karyawan/               # Employee portal pages (mobile web)
│   ├── dashboard/
│   ├── attendance/
│   └── work-order/
├── api/                    # API Routes (599 endpoints)
│   ├── admin/             # Admin API (241 endpoints)
│   ├── customer/          # Customer API (19 endpoints)
│   ├── mobile/            # Mobile app API (63 endpoints)
│   ├── cron/              # Scheduled jobs (26 endpoints)
│   ├── investor/          # Investor API (7 endpoints)
│   ├── public/            # Public API (4 endpoints)
│   └── [...other domains]
├── 403/                    # Error pages
├── page.tsx                # Landing page (marketing)
└── layout.tsx              # Root layout
```

### Classification

**Production-Critical Pages:**
- `/admin/*` — Full operational control
- `/api/admin/*` — Backend for admin operations
- `/api/mobile/*` — Mobile app backend
- `/api/cron/*` — Automated jobs

**Business-Critical Pages:**
- `/admin/pelanggan/*` — Customer management
- `/admin/finance/*` — Billing & payments
- `/admin/akuntansi/*` — Accounting & GL
- `/admin/network/*` — Network provisioning
- `/api/customer/auth/login` — Customer authentication

**Supporting Pages:**
- `/(customer)/*` — Customer self-service
- `/karyawan/*` — Employee mobile portal
- Landing page — Marketing & public info

---

## `/modules` — Domain Modules

### Structure (38 modules)
```
modules/
├── accounting/             # ✅ Clean Architecture (NEW)
│   ├── domain/
│   │   ├── entities/
│   │   └── ports/
│   ├── dto/
│   ├── repositories/
│   ├── mappers/
│   ├── services/
│   ├── validators/
│   └── index.ts
├── pelanggan/              # ✅ Clean Architecture (NEW)
│   ├── domain/
│   │   ├── entities/
│   │   └── ports/
│   ├── dto/
│   ├── repositories/
│   ├── mappers/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── index.ts
├── planning/               # ✅ Clean Architecture (NEW) — In staging
│   ├── domain/
│   │   ├── entities/
│   │   └── ports/
│   ├── dto/
│   ├── mappers/
│   └── index.ts
├── finance/                # ⚠️  Legacy (needs migration)
│   ├── dto/
│   ├── repositories/
│   ├── services/
│   └── index.ts
├── attendance/             # ⚠️  Legacy (needs migration)
├── work-order/             # ⚠️  Legacy
├── inventory/              # ⚠️  Legacy
├── network/                # ⚠️  Legacy
├── olt/                    # ⚠️  Legacy
├── notification/           # ⚠️  Legacy
├── mitra/                  # ⚠️  Legacy
├── salary/                 # ⚠️  Legacy
├── roles/                  # ⚠️  Legacy
└── [25+ other modules]
```

### Module Categories

**Core Business (High Priority):**
- `pelanggan` — Customer management
- `finance` — Billing, invoicing, payments
- `accounting` — Double-entry accounting
- `network` — MikroTik provisioning
- `olt` — OLT/ONU management

**HR & Operations:**
- `attendance` — Check-in/out, geofencing
- `salary` — Payroll calculations
- `overtime` — Overtime tracking
- `work-order` — Field operations
- `inventory` — Stock management
- `procurement` — Purchase orders

**Platform Services:**
- `roles` — RBAC permissions
- `users` — User management
- `admin` — Admin utilities
- `settings` — Configuration
- `tenant` — Multi-tenancy
- `feature-flags` — Feature toggles

**Communication:**
- `notification` — Email, WhatsApp, push
- `chat` — Real-time messaging

**External Integration:**
- `integrations` — Third-party APIs
- `payment-gateway` — Payment providers
- `app-update` — Mobile OTA updates

**Supporting:**
- `marketing` — Campaigns, leads
- `website` — CMS for landing pages
- `tax` — Tax calculations
- `investor` — Profit sharing
- `reseller` — Reseller management
- `coupons` — Discount management
- `map` — Geolocation services
- `shift` — Shift scheduling
- `registration` — Customer registration workflow

**Infrastructure:**
- `database` — Shared database utilities
- `events` — Event dispatchers

---

## `/lib` — Shared Libraries

### Structure
```
lib/
├── auth/                   # Authentication logic
│   ├── config.ts
│   ├── callbacks.ts
│   ├── permissions.ts
│   ├── session.ts
│   └── super-admin.ts
├── event-bus/              # Event system
│   ├── event-bus.ts
│   ├── event-handlers.ts
│   └── types.ts
├── utils/                  # Utilities
│   ├── env.ts             # Environment validation
│   ├── event-emitter-config.ts
│   └── [other utils]
├── rbac.ts                 # Role-Based Access Control
├── redis.ts                # Redis client
├── prisma.ts               # Prisma main client
├── prisma-radius.ts        # Prisma RADIUS client
├── prisma-billing.ts       # Prisma Billing client
├── prisma-mitra.ts         # Prisma Mitra client
├── api-response.ts         # Standardized API responses
├── logger.ts               # Pino logger
├── cache.ts                # Cache utilities
├── tenant-context.ts       # Multi-tenancy
├── cron-registry.ts        # Cron job registry
├── shutdown-manager.ts     # Graceful shutdown
├── permissions.ts          # Permission definitions
├── permission-aliases.ts   # Permission grouping
└── [50+ other utilities]
```

### Classification

**Infrastructure-Critical:**
- `redis.ts` — Redis singleton client
- `prisma*.ts` — Database clients
- `logger.ts` — Structured logging
- `shutdown-manager.ts` — Graceful shutdown

**Business-Critical:**
- `rbac.ts` — Authorization enforcement
- `tenant-context.ts` — Multi-tenancy isolation
- `auth/` — Authentication flow
- `event-bus/` — Domain events

**Security-Sensitive:**
- `auth/` — Session management
- `rbac.ts` — Permission checks
- `crypto.ts` — Encryption utilities
- `jwt.ts` — Token signing

**Supporting:**
- `api-response.ts` — HTTP response helpers
- `cache.ts` — Cache layer
- `csv.ts` — CSV generation
- `utils/` — General utilities

---

## `/components` — React Components

### Structure
```
components/
├── ui/                     # Base UI components (shadcn-style)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── [50+ components]
├── auth/                   # Authentication components
│   ├── LoginForm.tsx
│   ├── LoginForm.constants.ts
│   └── LoginForm.utils.ts
├── admin/                  # Admin-specific components
│   ├── Dashboard/
│   ├── Sidebar/
│   └── Navbar/
├── customer/               # Customer portal components
├── landing/                # Marketing landing page
│   ├── SaasLandingPage.tsx
│   └── landing-content.ts
└── [domain-specific folders]
```

---

## `/prisma` — Database Layer

### Structure
```
prisma/
├── schema.prisma           # Main database schema (11,455 lines)
├── schema-radius.prisma    # RADIUS database schema
├── schema-billing.prisma   # Billing database schema
├── schema-mitra.prisma     # Mitra database schema
├── migrations/             # Migration history (87 migrations)
│   ├── 20260313000000_init_squashed/
│   ├── 20260314015651_init_tenant_schema/
│   ├── [85+ other migrations]
│   └── migration_lock.toml
├── seed.ts                 # Database seeding script
├── seed-permissions.ts     # Permission seed
├── seed-accounting.ts      # Accounting COA seed
└── generated/              # Generated Prisma clients (gitignored)
    ├── radius/
    ├── billing/
    └── mitra/
```

### Key Files

**Schema Files:**
- `schema.prisma` — 199 models, main application data
- `schema-radius.prisma` — RADIUS authentication tables
- `schema-billing.prisma` — Financial transactions (isolated for audit)
- `schema-mitra.prisma` — Reseller/partner data

**Seed Scripts:**
- `seed.ts` — Main: users, roles, permissions, tenants, sample data
- `seed-permissions.ts` — Permission definitions sync
- `seed-accounting.ts` — Chart of Accounts (COA) initialization

---

## `/tests` — Test Suite

### Structure
```
tests/
├── setup.ts                # Vitest global setup
├── modules/                # Module-specific tests
│   ├── accounting/
│   ├── pelanggan/
│   ├── finance/
│   └── [other modules]
├── api/                    # API integration tests
│   ├── admin-*.test.ts
│   ├── mobile-*.test.ts
│   └── customer-*.test.ts
├── ui/                     # UI component tests
│   ├── restock-pdf.test.ts
│   └── procurement-po-pdf.test.ts
├── lib/                    # Library unit tests
│   ├── auth.test.ts
│   ├── rbac.test.ts
│   └── [utility tests]
└── e2e/                    # E2E tests (Playwright)
```

**Test Count:** 582 test files

---

## `/docs` — Documentation

### Structure
```
docs/
├── project-memory/         # 🆕 THIS DOCUMENTATION (generated by agent)
│   ├── INDEX.md
│   ├── 00-overview.md
│   ├── 01-stack.md
│   ├── 02-directory-map.md
│   └── [13+ other files]
├── architecture/           # Architecture documentation
│   ├── clean-architecture.md
│   ├── [other arch docs]
├── standards/              # Development standards
│   ├── error-handling.md
│   ├── authorization.md
│   ├── caching.md
│   ├── testing.md
│   ├── events.md
│   ├── transactions.md
│   ├── security-performance.md
│   ├── data-fetching.md
│   └── mobile-update-strategy.md
├── guides/                 # Implementation guides
├── reports/                # Analysis reports (82 files)
│   ├── api-routes-analysis.json
│   ├── api-routes-report.md
│   └── [other reports]
├── CHANGELOG.md            # Source of truth for changes (472 KB)
└── [other docs]
```

---

## `/k8s` — Kubernetes Configuration

### Structure
```
k8s/
└── production/             # Production namespace only (staging retired)
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secrets.yaml        # Gitignored
    ├── deployment.yaml
    ├── deployment-cron.yaml
    ├── deployment-radius.yaml
    ├── service.yaml
    ├── service-radius.yaml
    ├── ingress.yaml
    └── hpa.yaml            # Horizontal Pod Autoscaler
```

**Deployment Strategy:** Rolling update, zero downtime

---

## `/scripts` — Utility Scripts

### Notable Scripts
```
scripts/
├── setup-test-db.sh        # Setup isolated test database
├── run-husky-prepare.js    # Husky git hooks setup
├── backfill-tenant.ts      # Tenant data backfill
└── audit-claude-compliance.ts  # Code quality audit
```

---

## Configuration Files (Root)

| File | Purpose |
|------|---------|
| `server.ts` | Custom Node.js server with Socket.IO |
| `worker.ts` | BullMQ background worker |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript compiler config |
| `tsconfig.typecheck.json` | Stricter config for type checking |
| `vitest.config.ts` | Vitest test configuration |
| `playwright.config.ts` | Playwright E2E config |
| `eslint.config.mjs` | ESLint rules |
| `tailwind.config.ts` | Tailwind CSS config |
| `postcss.config.js` | PostCSS config |
| `package.json` | Dependencies & npm scripts |
| `docker-compose.yml` | Local dev services |
| `docker-compose.production.yml` | Production services |
| `Dockerfile` | Main app image |
| `Jenkinsfile` | CI/CD pipeline |
| `.env` | Local environment (gitignored) |
| `.env.production.example` | Production template |
| `CLAUDE.md` | AI agent guidelines |

---

## Generated / Ignored Directories

**Never commit these:**
- `node_modules/` — Dependencies
- `.next/` — Next.js build output
- `dist/`, `build/` — Build artifacts
- `prisma/generated/` — Prisma client code
- `coverage/` — Test coverage reports
- `.claude/` — Claude Code session data
- `.worktrees/` — Git worktrees
- `.turbo/` — Turbopack cache

---

## File Naming Conventions

### TypeScript Files
- **Components:** `PascalCase.tsx` (e.g., `LoginForm.tsx`)
- **Utilities:** `kebab-case.ts` (e.g., `api-response.ts`)
- **Services:** `PascalCase.ts` (e.g., `PelangganService.ts`)
- **Constants:** `kebab-case.constants.ts`
- **Types:** `kebab-case.types.ts`
- **Tests:** `*.test.ts` or `*.test.tsx`

### Modules
- **Index exports:** `index.ts` (public API)
- **DTO:** `*DTO.ts` (e.g., `PelangganDTO.ts`)
- **Entity:** `*Entity.ts` (e.g., `PelangganEntity.ts`)
- **Repository:** `*Repository.ts` (e.g., `PelangganRepository.ts`)
- **Service:** `*Service.ts` (e.g., `PelangganService.ts`)
- **Mapper:** `*Mapper.ts` (e.g., `PelangganMapper.ts`)

---

## Directory Ownership

| Directory | Owner | Maintainer |
|-----------|-------|------------|
| `/app` | Frontend team | Full-stack developers |
| `/modules` | Backend team | Domain experts |
| `/lib` | Platform team | Senior engineers |
| `/components` | Frontend team | UI/UX developers |
| `/prisma` | Database team | Backend engineers |
| `/tests` | QA + Developers | All contributors |
| `/docs` | Tech writers + AI agents | Project maintainers |
| `/k8s` | DevOps team | Infrastructure engineers |

---

## File Count Summary

- **Total Files:** ~7,493
- **TypeScript/JavaScript:** ~633,072 LOC
- **Test Files:** 582
- **API Routes:** 599
- **Modules:** 38
- **Components:** ~200+
- **Database Models:** 199
- **Migrations:** 87

---

**Directory Map:** COMPLETED  
**Classification:** Production-critical vs Supporting  
**Architecture:** Modular Monolith with Clean Architecture migration in progress
