# API Routes Analysis - Quick Reference

**Total Endpoints**: 599

## By Category
- **Admin**: 241 (40.2%)
- **Other**: 238 (39.7%)
- **Mobile**: 63 (10.5%)
- **Cron**: 26 (4.3%)
- **Customer**: 19 (3.2%)
- **Investor**: 7 (1.2%)
- **Public**: 4 (0.7%)
- **Webhooks**: 1 (0.2%)

## Critical Domains

### Financial (HIGH PRIORITY)
- `/api/admin/invoices/*` - Invoice management
- `/api/admin/payments/*` - Payment processing
- `/api/admin/finance/*` - AR aging, revenue, cohorts
- `/api/admin/accounting/*` - COA, journals, reports
- `/api/customer/payments` - Customer self-payment

**External**: Xendit, Tripay

### Customer Management (HIGH PRIORITY)
- `/api/admin/pelanggan/*` - Admin customer CRUD
- `/api/pelanggan-ppp/*` - PPPoE customer management
- `/api/customer/*` - Customer self-service portal
- `/api/registrations` - New customer registration

### Network Provisioning (HIGH PRIORITY)
- `/api/mikrotik-routers/*` - MikroTik management
- `/api/admin/radius/*` - RADIUS config
- `/api/olt/*` - OLT/ONU management
- `/api/bandwidths/*` - Bandwidth profiles

**External**: MikroTik RouterOS, FreeRADIUS, OLT APIs

### HR & Payroll (MEDIUM)
- `/api/attendance/*` - Employee attendance
- `/api/mobile/attendance/*` - Mobile check-in/out
- `/api/admin/salary/*` - Payroll processing
- `/api/admin/leaves/*` - Leave management

### Operations (MEDIUM)
- `/api/inventory/*` - Inventory & assets
- `/api/admin/procurement/*` - Purchase orders
- `/api/admin/workorders/*` - Work order lifecycle

## Authentication Patterns

| Pattern | Usage | Endpoints |
|---------|-------|-----------|
| `getServerSession` | Admin auth | `/admin/*`, `/olt/*`, `/bandwidths/*` |
| `requireCustomerAuth` | Customer portal | `/customer/*` |
| `getInvestorAuth` | Investor portal | `/investor/*` |
| Cron token | Scheduled jobs | `/cron/*` |
| `createHandler({ auth: true })` | Modern pattern | Sedang diadopsi |

## External Services

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| MikroTik RouterOS | ~15 | Network device management |
| FreeRADIUS | ~8 | PPPoE authentication |
| OLT APIs | ~20 | Fiber optic provisioning |
| Xendit | ~5 | Payment gateway |
| Tripay | ~5 | Payment gateway |
| Fonnte WhatsApp | ~3 | Notifications |
| Firebase FCM | ~4 | Push notifications |
| Google Maps | ~2 | Geocoding |

## Security Findings

### ⚠️ Detected Issues
- **Low auth detection rate**: 83/599 (14%) endpoints detected with auth
  - Likely false negative (middleware-based auth not detected by static analysis)
  - **Action**: Manual verification required for all `/admin/*` routes

### ✅ Good Practices
- Service layer separation (business logic not in routes)
- Distributed locking for cron jobs
- Multi-tenant isolation via `tenantId`
- Standardized error handling (`ApiErrors.*`)

## Top Services by Usage

1. **pelanggan** (~40 endpoints) - Customer management, billing, PPPoE
2. **finance** (~35 endpoints) - Invoices, payments, AR, revenue
3. **accounting** (~26 endpoints) - COA, journals, reports
4. **attendance** (~20 endpoints) - Check-in/out, processing
5. **olt** (~18 endpoints) - OLT/ONU management
6. **network** (~15 endpoints) - MikroTik, bandwidth
7. **inventory** (~15 endpoints) - Assets, stock
8. **work-order** (~12 endpoints) - Work order lifecycle
9. **salary** (~8 endpoints) - Payroll
10. **mitra** (~8 endpoints) - Partner/reseller

## Files Generated

| File | Size | Purpose |
|------|------|---------|
| `docs/reports/api-routes-analysis.json` | 183 KB | Full JSON analysis (machine-readable) |
| `docs/reports/api-routes-report.md` | 1598 lines | Detailed documentation |
| `docs/reports/api-routes-executive-summary.md` | Comprehensive | Executive summary with recommendations |

## Next Actions

**Phase 7 - Business Logic Extraction:**
1. Deep dive into critical services (pelanggan, finance, accounting)
2. Map complete data flows for critical operations
3. Extract all business rules & validations
4. Create permission inventory from role definitions

**Security Audit (Recommended):**
1. Verify all `/api/admin/*` have proper auth
2. Audit file upload endpoints
3. Review cron job security (IP whitelist)
4. Verify webhook signature validation
