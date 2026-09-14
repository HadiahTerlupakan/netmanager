# NetManager Project Overview

**Last Updated:** 2026-08-09  
**Confidence:** 85% — Comprehensive analysis dengan beberapa area yang perlu verifikasi lebih lanjut

---

## Tujuan Utama Aplikasi

NetManager adalah aplikasi manajemen lengkap untuk Internet Service Provider (ISP) yang menangani FTTH (Fiber to the Home) operations. Aplikasi ini berfungsi sebagai **integrated business management platform** yang menggabungkan:

1. **Customer Management** — Manajemen pelanggan, registrasi, paket layanan
2. **Network Operations** — Provisioning MikroTik, RADIUS, OLT/ONU
3. **Financial Management** — Billing, invoicing, payment processing, accounting
4. **HR & Operations** — Attendance, payroll, inventory, work orders
5. **Multi-tenant Platform** — Support untuk reseller/mitra dengan isolated data

---

## Application Type

- **Framework:** Next.js 16 App Router (React Server Components + API Routes)
- **Deployment:** Kubernetes production environment via Gitea Actions CI/CD
- **Architecture:** Modular Monolith dengan layered architecture (sedang migrasi ke Clean Architecture)
- **Scale:** Enterprise-grade dengan multi-database strategy dan event-driven patterns

---

## Codebase Statistics

- **Total Files:** ~7,493 files
- **Total Lines of Code:** ~633,072 lines (TypeScript/JavaScript)
- **Modules:** 38 domain modules
- **API Endpoints:** 599 routes
- **Database Models:** 199 models (across 4 databases)
- **Test Files:** 582 test files
- **Dependencies:** 141 production packages

---

## Primary Stakeholders

1. **ISP Operators** — Admin portal untuk manajemen operasional penuh
2. **Customers (Pelanggan)** — Customer portal untuk self-service (tagihan, dukungan, koneksi)
3. **Employees (Karyawan)** — Mobile app untuk attendance, work orders, field operations
4. **Resellers (Mitra)** — Partner portal untuk manajemen sub-customers dan komisi
5. **Investors** — Investor portal untuk profit sharing dan financial reports

---

## Core Value Proposition

NetManager menggabungkan **technical network management** dengan **business operations** dalam satu platform terintegrasi, mengurangi kebutuhan untuk multiple disconnected systems.

**Key Differentiators:**
- Direct integration dengan network devices (MikroTik, OLT, RADIUS)
- Real-time provisioning dan monitoring
- Multi-tenant architecture untuk reseller support
- Event-driven architecture untuk reliability
- Full accounting integration (double-entry, GL, COA)

---

## Technology Foundation

### Runtime & Framework
- **Node.js:** ≥24.0.0 (specified in package.json engines)
- **Next.js:** 16.2.4 with App Router
- **TypeScript:** 5.9.3 (strict mode enforced)
- **React:** 19.2.4

### Database & Cache
- **PostgreSQL:** 16 (4 separate databases)
  - Main database: Application data
  - RADIUS database: PPPoE authentication
  - Billing database: Financial transactions
  - Mitra database: Partner/reseller data
- **Redis:** 7 (cache, rate limiting, queue, session)
- **Prisma ORM:** 7.7.0 (multi-schema support)

### External Services
- **MikroTik RouterOS:** node-routeros-v2 for PPP provisioning
- **FreeRADIUS:** PPPoE authentication & accounting
- **OLT Management:** SNMP, Telnet, SSH for fiber equipment
- **Firebase:** Realtime DB + Push notifications
- **Payment Gateways:** Xendit, Midtrans, Tripay, Duitku, Moota
- **WhatsApp:** Baileys library for customer notifications
- **AWS S3:** File storage

### Testing & Quality
- **Vitest:** 4.1.1 (unit & integration tests)
- **Playwright:** 1.58.1 (E2E tests)
- **ESLint + TypeScript:** Static analysis
- **Test Coverage:** Target 70%+ for business logic

### Infrastructure
- **Docker + Docker Compose:** Local development
- **Kubernetes:** Production deployment
- **Gitea Actions:** CI/CD pipeline (production-only)
- **Colima:** Docker runtime for macOS development

---

## Application Entry Points

### Development
```bash
npm run dev → tsx server.ts → Custom Node HTTP server
  ↓
Next.js App (dev mode with turbopack)
  ↓ 
Custom middleware for file uploads & Expo Updates
  ↓
Next.js request handler
```

### Production
```bash
npm run build → Next.js build (standalone output)
npm start → tsx server.ts → Production server
  ↓
Kubernetes Deployment (3 replicas)
LoadBalancer → Ingress → Service → Pods
```

### Background Workers
```bash
npm run worker → tsx worker.ts → BullMQ workers
  ↓
Process queued jobs (billing, notifications, provisioning)
```

---

## Domain Architecture

### Core Business Modules
1. **Customer Domain** (`pelanggan`) — Registration, status management, package assignment
2. **Finance Domain** (`finance`) — Invoicing, payment collection, AR aging
3. **Accounting Domain** (`accounting`) — GL, COA, journal entries, reports
4. **Network Domain** (`network`) — MikroTik provisioning, RADIUS integration
5. **OLT Domain** (`olt`) — ONU provisioning, monitoring, bulk operations

### Supporting Modules
- **Attendance & HR** — Check-in/out, geofencing, overtime, salary
- **Work Orders** — Field operations, technician assignment, status tracking
- **Inventory** — Stock management, procurement, restock
- **Marketing** — Campaigns, lead tracking
- **Settings** — System configuration, feature flags
- **Roles** — RBAC permissions management
- **Notifications** — Email, WhatsApp, push notifications
- **Chat** — Real-time messaging (Firebase Realtime Database)

---

## Data Flow Patterns

### Request Flow (Target Architecture)
```
Client Request
  ↓
API Route (Next.js /app/api)
  ↓
Middleware (Auth, RBAC, Rate Limit, Tenant Context)
  ↓
Service Layer (Business Logic)
  ↓
Repository Layer (Data Access via Prisma)
  ↓
Database (PostgreSQL)
```

### Event-Driven Flow
```
Business Action (e.g., Payment Received)
  ↓
Service emits Domain Event
  ↓
Event Bus (In-Memory + BullMQ Queue)
  ↓
Event Handlers (Async processing)
  ↓
Side Effects (Update status, send notification, sync network)
```

---

## Multi-Tenancy Strategy

**Isolation Level:** Row-level tenant isolation via `tenantId` foreign key

**Tenant Context Resolution:**
1. Subdomain-based: `admin.radpro.id`, `pelanggan.radpro.id`
2. Session-based: User's tenant from database
3. Header-based: Mobile app sends `x-tenant-id`

**Data Isolation:**
- All major tables include `tenantId` (nullable for global data)
- Repository layer automatically filters by tenant
- Middleware injects tenant context into request
- Super admin can bypass tenant isolation

---

## Development Workflow

```bash
# Setup
npm install
npm run db:up  # Start PostgreSQL + Redis
npm run prisma:generate
npm run prisma:migrate-deploy
npm run prisma:seed

# Development
npm run dev  # Start dev server at localhost:3000

# Testing
npm test  # Vitest watch mode
npm run test:coverage

# Quality Checks
npm run lint
npm run typecheck
npm run check  # lint + typecheck + test + build
```

---

## Deployment Flow

```
Developer push to main branch
  ↓
Gitea Actions (.gitea/workflows/deploy-production.yml)
  ├─ quality (lint, typecheck, tests)
  ├─ build  (app, cron, radius images -> push ke registry)
  └─ deploy (preflight -> backup DB -> migration job -> apply manifes)
       ↓
     Deploy to K8s production namespace via SSH
  ↓
Rolling update (zero downtime)
  ↓
Health check verification
  ↓
Success or Rollback
```

---

## Critical System Dependencies

### Cannot Operate Without:
1. **PostgreSQL** — Main application data
2. **Redis** — Session, cache, rate limiting, queues
3. **Firebase** — Push notifications, real-time chat

### Can Degrade Gracefully:
1. **MikroTik** — Provisioning fails, manual fallback
2. **RADIUS** — Auth works via database fallback
3. **OLT** — Provisioning disabled, UI shows warnings
4. **Payment Gateways** — Manual payment entry available
5. **WhatsApp** — Email fallback for notifications

---

## Known Architectural Transitions

### Migration In Progress: Pola Lama → Clean Architecture

**Status:** ~30% modules migrated

**Pola Baru (Target):**
```
modules/<domain>/
├── domain/entities/     # Pure TypeScript entities
├── domain/ports/        # Repository interfaces
├── repositories/        # Prisma implementations
├── mappers/             # Prisma ↔ Entity ↔ DTO
├── services/            # Business logic
└── index.ts             # Public API (DTO + Services only)
```

**Pola Lama (Legacy):**
```
modules/<domain>/
├── repositories/        # Prisma + interface
├── services/            # Business logic (may use Prisma types directly)
└── index.ts             # Public API
```

**Migration Trigger:** Review, new features, or bug fixes on old modules

---

## Security Model

### Authentication
- **NextAuth.js** — Session-based with secure HTTP-only cookies
- **Session Storage** — Redis-backed for horizontal scaling
- **JWT Tokens** — Employee portal mobile API

### Authorization
- **RBAC** — Role-Based Access Control via `roles` & `permissions` tables
- **Permission Aliases** — Grouped permissions for common actions
- **Super Admin** — Bypass for SUPER_ADMIN role
- **Tenant Isolation** — Row-level security via middleware

### Security Features
- Rate limiting (5 req/min for auth endpoints)
- IP blocking after 5 failed logins (1 hour)
- Security event logging to console (K8s)
- CSRF protection via NextAuth
- Secure headers via Helmet middleware
- Environment variable validation on startup

---

## Performance Targets

**API Response Time:**
- p95 < 200ms for simple queries
- p99 < 500ms for complex operations

**Database Query:**
- Simple < 10ms
- Complex < 100ms
- Background jobs: No hard limit

**Cache Strategy:**
- Reference data: 1 hour TTL
- Expensive queries: 5-15 min TTL
- Session data: 7 days (configurable)

---

## Next Steps for Onboarding

1. Read `docs/project-memory/INDEX.md` — Navigation hub
2. Review `docs/architecture/clean-architecture.md` — Architectural patterns
3. Check `docs/CHANGELOG.md` — Recent changes
4. Explore `modules/<domain>/` — Domain-specific code
5. Run test suite — Verify local setup

---

## Support & Documentation

- **Main Docs:** `docs/` directory
- **Architecture:** `docs/architecture/`
- **Standards:** `docs/standards/`
- **API Reference:** `docs/api/`
- **CLAUDE.md:** Project conventions for AI agents

---

**Reconnaissance Completed:** Phase 1-3  
**Remaining Phases:** 4-17 (in progress via subagents)
