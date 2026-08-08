# API Routes - Executive Summary

**Generated**: 2026-08-09  
**Analyst**: Claude Agent  
**Scope**: Complete API route structure analysis for NetManager application

---

## Overview

NetManager memiliki **599 API endpoints** yang terdistribusi di 8 kategori utama. Aplikasi ini menggunakan Next.js App Router dengan struktur modular yang memisahkan concerns antara admin, customer, mobile app, dan scheduled jobs.

### Quick Stats

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Endpoints** | 599 | 100% |
| **Admin Endpoints** | 241 | 40.2% |
| **Mobile Endpoints** | 63 | 10.5% |
| **Customer Endpoints** | 19 | 3.2% |
| **Cron Jobs** | 26 | 4.3% |
| **Public Endpoints** | 4 | 0.7% |
| **Authenticated** | 83+ | ~14% (detected) |
| **Public/Unprotected** | 516+ | ~86% |
| **Critical Business** | 98 | 16.4% |
| **External Integrations** | 66 | 11% |

---

## Architecture Patterns

### Authentication Patterns Detected

Aplikasi menggunakan multiple authentication strategies:

1. **Admin Auth** (`getServerSession` + `authOptions`)
   - Standard NextAuth.js session-based
   - Used in: `/api/admin/*`, `/api/bandwidths/*`, `/api/olt/*`
   
2. **Customer Auth** (`requireCustomerAuth` / `verifyCustomerAuth`)
   - Customer portal authentication
   - Used in: `/api/customer/*`
   
3. **Investor Auth** (`verifyInvestorAuth` / `getInvestorAuth`)
   - Separate auth for investor portal
   - Used in: `/api/investor/*`
   
4. **Cron Auth** (`verifyCronToken` / Bearer token check)
   - Secret-based authentication for scheduled jobs
   - Used in: `/api/cron/*`
   
5. **Helper-based Auth** (`requireAuth`, `requireAdmin`)
   - Wrapper functions for common auth patterns
   - Used across various routes

6. **Handler-based Auth** (`createHandler({ auth: true })`)
   - Declarative auth via handler wrapper
   - Modern pattern, sedang diadopsi

### Authorization Pattern

Permission-based access control menggunakan `hasPermission()` dari `@/lib/rbac`:

```typescript
if (!(await hasPermission("bandwidth:read"))) {
  return ApiErrors.forbidden("Anda tidak memiliki akses");
}
```

**Common permissions detected:**
- `bandwidth:read`, `bandwidth:write`
- `harga:read`, `harga:write`
- `olt:read`, `olt:write`
- `olt_onu:read`, `olt_logs:read`
- Dan banyak lagi (perlu inventory lengkap dari role definitions)

---

## Critical Business Endpoints

### 1. Authentication & Session Management

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | Public | NextAuth.js handler |
| `/api/auth/firebase-token` | POST | Authenticated | Firebase auth token exchange |
| `/api/customer/auth/*` | GET, POST | Mixed | Customer login/logout |
| `/api/investor/auth/*` | GET, POST | Mixed | Investor login/logout |

### 2. Financial Operations

| Endpoint | Methods | Auth | Critical Level |
|----------|---------|------|----------------|
| `/api/admin/invoices/*` | GET, POST, PATCH | Admin | **HIGH** |
| `/api/admin/payments/*` | GET, POST, PATCH | Admin | **HIGH** |
| `/api/admin/finance/*` | GET, POST | Admin | **HIGH** |
| `/api/admin/accounting/*` | GET, POST, PUT, DELETE | Admin | **HIGH** |
| `/api/customer/invoices` | GET | Customer | MEDIUM |
| `/api/customer/payments` | GET, POST | Customer | **HIGH** |
| `/api/billing/analytics` | GET | Admin | MEDIUM |

**External integrations:**
- Xendit Payment Gateway
- Tripay Payment Gateway

### 3. Customer Management (Pelanggan)

| Endpoint | Methods | Auth | Critical Level |
|----------|---------|------|----------------|
| `/api/admin/pelanggan/*` | GET, POST, PUT, DELETE | Admin | **HIGH** |
| `/api/pelanggan-ppp/*` | GET, POST, PUT, DELETE | Admin | **HIGH** |
| `/api/customer/profile` | GET, PATCH | Customer | MEDIUM |
| `/api/registrations` | POST | Public | **HIGH** |

### 4. Network Provisioning & Management

| Endpoint | Methods | Auth | Critical Level | External |
|----------|---------|------|----------------|----------|
| `/api/mikrotik-routers/*` | GET, POST, PUT, DELETE | Admin | **HIGH** | MikroTik RouterOS |
| `/api/admin/radius/*` | GET, POST | Admin | **HIGH** | FreeRADIUS |
| `/api/olt/devices/*` | GET, POST, PUT, DELETE | Admin | **HIGH** | OLT Devices |
| `/api/olt/onu/*` | GET, POST, PUT, DELETE | Admin | **HIGH** | ONU Management |
| `/api/bandwidths/*` | GET, POST, PUT, DELETE | Admin | MEDIUM | - |
| `/api/profileppps/*` | GET, POST, PUT, DELETE | Admin | MEDIUM | - |

**External integrations:**
- MikroTik RouterOS API (node-routeros-v2)
- FreeRADIUS (ports 1812/1813 UDP)
- OLT Vendor APIs (Huawei, ZTE, dll)
- MixRadius integration

### 5. Inventory & Procurement

| Endpoint | Methods | Auth | Critical Level |
|----------|---------|------|----------------|
| `/api/inventory/*` | GET, POST, PUT, DELETE | Admin | MEDIUM |
| `/api/admin/procurement/*` | GET, POST, PUT, DELETE | Admin | **HIGH** |

### 6. HR & Attendance

| Endpoint | Methods | Auth | Critical Level |
|----------|---------|------|----------------|
| `/api/attendance/*` | GET, POST | Employee | MEDIUM |
| `/api/mobile/attendance/*` | GET, POST | Mobile | MEDIUM |
| `/api/admin/attendance/*` | GET, PUT | Admin | MEDIUM |
| `/api/admin/salary/*` | GET, POST | Admin | **HIGH** |
| `/api/admin/leaves/*` | GET, POST, PUT | Admin | MEDIUM |

---

## Category Breakdown

### 1. Admin Routes (`/api/admin/*`) - 241 endpoints

Largest category, mencakup:

**Subdomains:**
- `/admin/accounting/*` - 26 endpoints (COA, Journal, Reconciliation, Reports)
- `/admin/pelanggan/*` - Multiple endpoints (CRUD, billing, PPPoE)
- `/admin/finance/*` - AR aging, revenue, cohort analysis
- `/admin/invoices/*` - Invoice management & void
- `/admin/payments/*` - Payment processing
- `/admin/users/*` - User management
- `/admin/attendance/*` - Attendance admin functions
- `/admin/salary/*` - Payroll processing
- `/admin/procurement/*` - Purchase orders
- `/admin/inventory/*` - Inventory management (assets, barang, jasa)
- `/admin/workorders/*` - Work order lifecycle
- `/admin/mitra/*` - Partner/reseller management
- `/admin/marketing/*` - Sales & canvasing
- `/admin/integrations/*` - External API configs
- `/admin/settings/*` - System settings
- `/admin/chat/*` - Internal chat management
- `/admin/notifications/*` - Notification management & dead letter
- `/admin/incidents/*` - Incident tracking
- `/admin/shifts/*` - Shift management
- `/admin/holidays/*` - Holiday configuration
- `/admin/leaves/*` - Leave request management
- `/admin/lembur/*` - Overtime management
- `/admin/departments/*` - Department CRUD
- `/admin/app-releases/*` - Mobile app version management
- `/admin/app-update/*` - Mobile app OTA updates
- `/admin/whatsapp/*` - WhatsApp integration
- `/admin/support-tickets/*` - Support ticket system
- `/admin/reports/*` - Various business reports
- `/admin/investors/*` - Investor management & profit sharing
- `/admin/sites/*` - Multi-site management
- `/admin/coupons/*` - Coupon/promo management
- `/admin/event-bus/*` - Event bus health check
- `/admin/system-logs/*` - System audit logs
- `/admin/tenant-domains/*` - Custom domain management
- `/admin/tenants/*` - Multi-tenant management
- `/admin/tax/*` - Tax calculation & management
- `/admin/payment-gateway/*` - Payment gateway config
- `/admin/accel-ppp-servers/*` - PPPoE server management
- `/admin/radius/*` - RADIUS configuration
- `/admin/company-bank-accounts/*` - Company bank accounts
- `/admin/resellers/*` - Reseller management
- `/admin/website/*` - Website content management
- `/admin/options/*` - Global options/settings
- `/admin/location/*` - Location tracking (live & history)
- `/admin/profile/*` - Admin profile

**Auth Pattern:**
- Mostly `getServerSession` + `hasPermission()`
- Some use `requireAuth()` or `requireAdmin()`

**Key Services:**
- modules/pelanggan
- modules/finance
- modules/accounting
- modules/inventory
- modules/attendance
- modules/salary
- modules/work-order
- modules/mitra
- modules/marketing
- modules/users
- modules/roles

### 2. Mobile Routes (`/api/mobile/*`) - 63 endpoints

Mobile app API, mencakup:

**Subdomains:**
- `/mobile/auth/*` - Mobile authentication
- `/mobile/attendance/*` - Check-in/check-out
- `/mobile/dashboard` - Mobile dashboard
- `/mobile/work-orders/*` - Work order mobile view
- `/mobile/notifications/*` - Push notifications
- `/mobile/profile/*` - Employee profile
- `/mobile/leaves/*` - Leave requests
- `/mobile/overtime/*` - Overtime submission
- `/mobile/salary/*` - Salary slip view
- `/mobile/inventory/*` - Inventory mobile view
- `/mobile/chat/*` - Chat integration
- `/mobile/location/*` - Location tracking
- `/mobile/geofence/*` - Geofence validation
- `/mobile/app-version/*` - App version check
- `/mobile/app-update/*` - OTA update check
- `/mobile/fcm-token/*` - FCM token registration
- `/mobile/push-token/*` - Push notification token
- `/mobile/upload/*` - File upload
- `/mobile/departments/*` - Department list
- `/mobile/holidays/*` - Holiday list
- `/mobile/announcements/*` - Company announcements
- `/mobile/mitra/*` - Partner features
- `/mobile/mixradius/*` - MixRadius integration
- `/mobile/partners/*` - Partner list
- `/mobile/topology/*` - Network topology view
- `/mobile/ping/*` - Network connectivity check
- `/mobile/error-report/*` - Error reporting

**Auth Pattern:**
- Mobile-specific auth (likely JWT or custom session)
- Different from admin auth

**Key Features:**
- Geofence-based attendance
- Real-time location tracking
- Push notifications (Firebase FCM)
- OTA updates (Expo EAS)
- Work order assignment & completion
- Salary slip access
- Leave & overtime submission

### 3. Customer Routes (`/api/customer/*`) - 19 endpoints

Customer self-service portal:

**Available:**
- `/customer/auth/*` - Login/logout
- `/customer/dashboard` - Customer dashboard
- `/customer/profile` - Profile management
- `/customer/invoices` - Invoice history
- `/customer/payments` - Payment history & make payment
- `/customer/usage` - Data usage statistics
- `/customer/package` - Package info & change request
- `/customer/tickets` - Support tickets
- `/customer/payment-methods` - Saved payment methods
- `/customer/notifications/*` - Customer notifications
- `/customer/announcements` - Company announcements

**Auth Pattern:**
- `requireCustomerAuth()` or `verifyCustomerAuth()`
- Separate session dari admin

**Key Services:**
- modules/pelanggan (CustomerPortalService)
- modules/finance
- modules/support-tickets

### 4. Cron Routes (`/api/cron/*`) - 26 endpoints

Scheduled background jobs:

**Jobs:**
- `/cron/apply-pending-packages` - Apply scheduled package changes
- `/cron/process-overdue` - ⚠️ DEPRECATED (use reconcile-billing-schedules)
- `/cron/reconcile-billing-schedules` - Billing reconciliation & isolation
- `/cron/accounting/*` - Accounting period jobs
- `/cron/ar-aging-snapshot` - AR aging calculation
- `/cron/revenue-snapshot` - Revenue snapshot
- `/cron/customer-cohort` - Customer cohort analysis
- `/cron/attendance-alert` - Attendance reminders
- `/cron/attendance-orchestrator` - Attendance processing orchestrator
- `/cron/process-absence` - Process absences
- `/cron/auto-checkout` - Auto checkout missed employees
- `/cron/auto-approve-leave` - Auto approve eligible leaves
- `/cron/auto-reject-expired-leaves` - Reject expired leave requests
- `/cron/send-leave-reminders` - Leave reminder notifications
- `/cron/cleanup-notification-logs` - Cleanup old notifications
- `/cron/cleanup-stale-fcm-tokens` - Remove invalid FCM tokens
- `/cron/depreciation` - Asset depreciation calculation
- `/cron/olt-discovery` - OLT device discovery
- `/cron/olt-monitoring` - OLT health monitoring
- `/cron/rab-status-eval` - RAB status evaluation
- `/cron/tax/*` - Tax calculation jobs
- `/cron/tenant-domain-verify` - Verify tenant custom domains
- `/cron/workorder-reminder` - Work order SLA reminders
- `/cron/workorder-sla-monitor` - Work order SLA monitoring

**Auth Pattern:**
- Bearer token dengan `CRON_SECRET` dari env
- Menggunakan `acquireCronLock()` untuk prevent concurrent execution

**Key Features:**
- Distributed locking via Redis
- Job-specific TTL (5-60 minutes)
- Idempotent execution
- Error handling dengan dead letter queue

### 5. Investor Routes (`/api/investor/*`) - 7 endpoints

Investor portal:

**Available:**
- `/investor/auth/*` - Investor login/logout/session
- `/investor/dashboard` - Investment summary
- `/investor/projects` - Project list
- `/investor/projects/:id` - Project detail
- `/investor/payouts` - Payout history

**Auth Pattern:**
- `getInvestorAuth()` / `verifyInvestorAuth()`
- Separate authentication dari admin & customer

**Key Services:**
- modules/investor (InvestorPortalService)

### 6. Public Routes (`/api/public/*`) - 4 endpoints

Truly public endpoints (no auth):

- `/public/status` - System status
- `/public/registration-status` - Check registration status
- `/public/landing-content` - Website landing page content
- `/public/captcha-settings` - Captcha configuration

### 7. Webhooks (`/api/webhooks/:provider`) - 1 endpoint

Payment gateway webhooks:

- `/webhooks/[provider]` - Dynamic provider handler (Xendit, Tripay, dll)

**Auth:**
- Webhook signature verification (provider-specific)

### 8. Other Routes (238 endpoints)

Routes yang tidak masuk kategori di atas, termasuk:

- `/api/acs/*` - ACS (Auto Configuration Server) for CPE management
- `/api/announcements/*` - System announcements
- `/api/attendance/*` - Employee self-service attendance
- `/api/auth/*` - Authentication handlers (NextAuth)
- `/api/bandwidths/*` - Bandwidth profiles
- `/api/billing/*` - Billing analytics
- `/api/coupons/*` - Coupon verification & redemption
- `/api/docs/*` - API documentation (Swagger/OpenAPI?)
- `/api/finance/*` - Finance operations
- `/api/hargapakets/*` - Package pricing
- `/api/health/*` - Health checks
- `/api/integrations/*` - External integrations
- `/api/internal/*` - Internal tools (WhatsApp, dll)
- `/api/inventory/*` - Inventory operations
- `/api/invoices/*` - Invoice operations
- `/api/ip-info` - IP geolocation lookup
- `/api/ktp-ocr` - KTP OCR processing
- `/api/map/*` - Network topology map
- `/api/marketing/*` - Marketing operations
- `/api/mikrotik-routers/*` - MikroTik management
- `/api/network/*` - Network monitoring
- `/api/notifications/*` - User notifications
- `/api/odcs/*`, `/api/odps/*` - ODC/ODP management
- `/api/olt/*` - OLT management
- `/api/payments/*` - Payment processing
- `/api/pelanggan-ppp/*` - PPPoE customer management
- `/api/profileppps/*` - PPPoE profiles
- `/api/registrations` - New customer registration
- `/api/roles/*` - Role management
- `/api/scheduler/*` - Scheduled tasks
- `/api/settings/*` - System settings
- `/api/sites/*` - Site management
- `/api/tagihan/*` - Billing operations
- `/api/tenant/*` - Tenant operations
- `/api/upload/*`, `/api/uploads/*` - File uploads
- `/api/user/*` - User operations

---

## External Service Integrations (66 endpoints)

### Network Equipment

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **MikroTik RouterOS** | ~15 | Router management, bandwidth control, PPPoE provisioning |
| **FreeRADIUS** | ~8 | Authentication, accounting, PPPoE |
| **OLT Vendors (Huawei, ZTE)** | ~20 | ONU provisioning, monitoring, bandwidth profiles |

### Payment Gateways

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **Xendit** | ~5 | Payment processing, VA generation |
| **Tripay** | ~5 | Alternative payment gateway |

### Communication

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **Fonnte WhatsApp** | ~3 | WhatsApp notifications |
| **Firebase FCM** | ~4 | Push notifications (mobile) |
| **Firebase Realtime DB/Firestore** | ~5 | Real-time features (chat, location) |

### Utilities

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **Google Maps API** | ~2 | Geocoding, reverse geocoding |
| **Geoapify** | ~2 | Alternative geocoding |
| **ip-api.com** | 1 | IP geolocation |

### Integration APIs

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **MixRadius** | ~3 | External RADIUS integration |

---

## Security Observations

### 🔴 Critical Issues

1. **Low Authentication Coverage**
   - Only ~14% (83/599) endpoints have detected authentication
   - **Possible reasons:**
     - Many admin routes might have middleware-based auth not detected by static analysis
     - Public endpoints intentionally accessible
   - **Recommendation:** Manual audit of all `/api/admin/*` routes

2. **Critical Business Endpoints Without Auth (Detected)**
   - Several accounting, finance, and pelanggan endpoints show as "public"
   - **Likelihood:** False negative dari static analysis (middleware auth tidak terdeteksi)
   - **Action Required:** Verify with runtime inspection atau middleware checks

3. **Permission Granularity**
   - RBAC system sudah ada, tapi coverage tidak jelas
   - Perlu inventory lengkap dari semua available permissions

### 🟡 Medium Risk

1. **Cron Job Security**
   - Menggunakan single `CRON_SECRET` untuk semua jobs
   - No IP whitelisting detected
   - **Recommendation:** Consider IP whitelist atau job-specific secrets

2. **Webhook Signature Verification**
   - Single endpoint `/webhooks/[provider]` handle multiple providers
   - Perlu verify signature validation per provider

3. **File Upload Endpoints**
   - Multiple upload endpoints detected (`/upload`, `/uploads`, `/mobile/upload`, `/inventory/upload-photo`)
   - Perlu verify file type validation, size limits, dan malware scanning

### 🟢 Good Practices Detected

1. **Distributed Locking for Cron Jobs**
   - `acquireCronLock()` prevents concurrent execution
   - TTL-based automatic cleanup

2. **Multi-tenant Isolation**
   - `tenantId` used in session context
   - Site-based restrictions via `checkSiteRestriction()`

3. **Error Handling Standards**
   - Consistent use of `ApiErrors.*` dan `apiSuccess()`
   - Error codes standardized (`ErrorCodes.*`)

4. **Service Layer Separation**
   - Routes delegate to service layer (good separation of concerns)
   - Business logic tidak ada di route handlers

---

## API Design Patterns

### Response Format

**Success:**
```json
{
  "data": { ... },
  "message": "Success message (optional)"
}
```

**Error:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Pagination

Detected patterns:
- `?page=1&limit=20` (standard)
- `?offset=0&limit=50` (alternative)

### Filtering

Common query params:
- `?status=ACTIVE`
- `?siteId=xxx`
- `?search=keyword`
- `?featured=true`
- `?unread=true`

### Sorting

Not consistently detected (needs documentation review)

---

## Module-to-Endpoint Mapping

### Top Services by Endpoint Usage

1. **modules/pelanggan** - ~40 endpoints
   - Admin pelanggan CRUD
   - Customer portal
   - PPPoE provisioning
   - Billing

2. **modules/finance** - ~35 endpoints
   - Invoices
   - Payments
   - AR aging
   - Revenue tracking
   - Customer cohorts

3. **modules/accounting** - ~26 endpoints
   - Chart of Accounts
   - Journal entries
   - Reconciliation
   - Financial reports (Balance Sheet, P&L, Cash Flow)

4. **modules/attendance** - ~20 endpoints
   - Check-in/check-out
   - Admin attendance management
   - Absence processing
   - Reminders

5. **modules/olt** - ~18 endpoints
   - OLT device management
   - ONU provisioning
   - Bandwidth profiles
   - Monitoring & alerts

6. **modules/network** - ~15 endpoints
   - MikroTik management
   - Bandwidth profiles
   - PPPoE profiles
   - Network topology

7. **modules/inventory** - ~15 endpoints
   - Asset management
   - Stock management (barang, jasa)
   - Stock in/out
   - Opname
   - Depreciation

8. **modules/work-order** - ~12 endpoints
   - Work order CRUD
   - Assignment
   - Status tracking
   - SLA monitoring

9. **modules/salary** - ~8 endpoints
   - Payroll calculation
   - Salary slip generation
   - Overtime payment

10. **modules/mitra** - ~8 endpoints
    - Partner management
    - Commission calculation
    - Withdrawal processing

---

## Recommendations

### 1. Security Audit Priority

**HIGH PRIORITY:**
- [ ] Verify all `/api/admin/*` routes have proper authentication
- [ ] Verify all `/api/admin/*` routes have proper authorization (permission checks)
- [ ] Audit file upload endpoints for security (validation, size limits, malware scan)
- [ ] Review cron job security (IP whitelist, job-specific secrets)
- [ ] Audit webhook signature verification

**MEDIUM PRIORITY:**
- [ ] Review customer portal authentication flow
- [ ] Review investor portal authentication flow
- [ ] Audit mobile app authentication (token refresh, expiry)
- [ ] Review rate limiting implementation (especially public endpoints)

### 2. Documentation

**NEEDED:**
- [ ] Complete API documentation (OpenAPI/Swagger)
- [ ] Permission matrix (all available permissions + required roles)
- [ ] Webhook documentation (signature verification, payload format)
- [ ] Cron job schedule documentation
- [ ] External service integration guide

### 3. Code Quality

**IMPROVEMENTS:**
- [ ] Standardize auth pattern (migrate all to `createHandler({ auth: true })`)
- [ ] Remove deprecated endpoints (`/api/cron/process-overdue`)
- [ ] Consistent pagination (standardize page/limit vs offset/limit)
- [ ] Consistent error handling (all routes use ApiErrors)
- [ ] Add request validation schemas (Zod) to all routes

### 4. Monitoring & Observability

**NEEDED:**
- [ ] API endpoint usage analytics
- [ ] Error rate monitoring per endpoint
- [ ] Response time monitoring
- [ ] External service integration health checks
- [ ] Cron job execution monitoring & alerting

### 5. Performance

**IMPROVEMENTS:**
- [ ] Identify slow endpoints (>500ms p99)
- [ ] Add caching layer for frequently accessed data
- [ ] Optimize N+1 queries in list endpoints
- [ ] Add pagination to all list endpoints without limits

---

## Next Steps

1. **Deep Dive Analysis** (Phase 7: Business Logic Extraction)
   - Read critical service implementations
   - Map complete data flow for critical operations
   - Identify business rules & validations

2. **Permission Inventory** (Part of Phase 7)
   - Extract all permissions from role definitions
   - Create permission matrix
   - Map permissions to endpoints

3. **External Integration Deep Dive** (Phase 10)
   - Document each external service integration
   - Error handling & retry logic
   - Fallback mechanisms

4. **Critical Flow Tracing** (Phase 11)
   - Trace customer registration → provisioning → billing
   - Trace payment processing flow
   - Trace work order lifecycle
   - Trace attendance → payroll flow

---

*Report generated by automated API route analysis. Some detection may be incomplete due to middleware-based auth not visible in static analysis.*
