# API Routes Analysis Report

Generated: 9/8/2026, 04.04.06

## Executive Summary

- **Total Routes**: 599
- **Authenticated Routes**: 83
- **Public Routes**: 516
- **Critical Business Endpoints**: 98
- **External Service Integration Points**: 66

## Routes by Category

- **admin**: 241 endpoints
- **other**: 238 endpoints
- **mobile**: 63 endpoints
- **cron**: 26 endpoints
- **customer**: 19 endpoints
- **investor**: 7 endpoints
- **public**: 4 endpoints
- **webhooks**: 1 endpoints

---

## 1. Critical Business Endpoints (98)

These endpoints are critical for core business operations:

### `/admin/accounting/coa`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/coa/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/coa/seed`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/journal`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/journal/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/journal/:id/reverse`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/journal/opening-balance`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/period`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/period/:id/close`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/period/:id/reopen`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reconciliation`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reconciliation/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reconciliation/:id/complete`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reconciliation/:id/match`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/recurring`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/recurring/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/balance-sheet`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/cash-book`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/cash-flow`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/general-ledger`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/profit-loss`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/accounting/reports/trial-balance`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/finance/ar-aging`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/finance/customer-cohort`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/finance/revenue-snapshot`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/invoices/:id/void`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payment-gateway/configs`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payment-gateway/configs/:provider`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payment-gateway/test`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payments/:id/cancel`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payments/pending-manual`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/payments/verify-manual`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/pelanggan/:id/invoices`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/pelanggan/:id/notification-history`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/pelanggan/:id/prorate-log`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/radius/accounting/:username`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/admin/registrations`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/admin/registrations/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/auth/:...nextauth`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/auth/firebase-token`
- **Methods**: POST
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: Firebase

### `/billing/analytics`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/cron/accounting/health-check`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/cron/accounting/recurring`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/customer/auth/login`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/customer/auth/logout`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/customer/auth/me`
- **Methods**: GET
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/customer/invoices`
- **Methods**: GET
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/customer/payment-methods`
- **Methods**: GET
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/customer/payments`
- **Methods**: GET, POST
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/customer/payments/sse`
- **Methods**: GET
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/customer/payments/upload-receipt`
- **Methods**: POST
- **Auth**: 🔒 customerAuth
- **Services**: N/A
- **External Services**: None

### `/finance/accounts`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/finance/expense-categories`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/expense-categories/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/expenses`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/expenses/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/expenses/batch`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/pay-po`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/finance/rab-projects`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id/actuals`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id/copy`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id/revision-profit-loss`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id/revisions`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/:id/revisions/:revisionId`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/finance/rab-projects/:id/revisions/:revisionId/submit`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/rab-projects/dashboard`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/finance/stats`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/finance/transfer`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/finance/unmatched-mutations`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/integrations/mixradius/invoice-counts`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/investor/auth/login`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/investor/auth/logout`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/investor/auth/session`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/invoices`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/invoices/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/invoices/:id/send`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/mobile/auth/firebase-token`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: Firebase

### `/mobile/auth/login`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/mobile/auth/logout`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/mobile/auth/me`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/mobile/auth/refresh`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/payments`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/payments/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/:id/activate`
- **Methods**: POST
- **Auth**: 🔒 requireAuth
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/pelanggan-ppp/:id/cancel-pending-package`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/:id/status`
- **Methods**: PATCH
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/:id/suspend`
- **Methods**: POST
- **Auth**: 🔒 requireAuth
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/pelanggan-ppp/:id/suspension-history`
- **Methods**: GET
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/:id/usage`
- **Methods**: GET
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: FreeRADIUS

### `/pelanggan-ppp/:id/usage/history`
- **Methods**: GET
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/check-id`
- **Methods**: GET
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: None

### `/pelanggan-ppp/generate-id`
- **Methods**: GET
- **Auth**: 🔒 getServerSession
- **Services**: N/A
- **External Services**: None

### `/public/registration-status/:id`
- **Methods**: GET
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/registrations`
- **Methods**: POST
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None

### `/tagihan/pelanggan/:id`
- **Methods**: N/A
- **Auth**: 🔓 Public
- **Services**: N/A
- **External Services**: None


---

## 2. External Service Integration Points (66)

Endpoints that interact with external APIs:

### Firebase (2 endpoints)

- `POST /auth/firebase-token`
- `POST /mobile/auth/firebase-token`

### FreeRADIUS (58 endpoints)

- ` /admin/integrations/mixradius/sync`
- ` /admin/radius/accounting/:username`
- ` /admin/radius/dashboard/recent-sessions`
- ` /admin/radius/dashboard/stats`
- ` /admin/radius/debug/live-usage`
- ` /admin/radius/ippool`
- ` /admin/radius/ippool/:ipAddress`
- ` /admin/radius/nas`
- ` /admin/radius/nas/:id`
- ` /admin/radius/orphans`
- ` /admin/radius/sessions`
- ` /admin/radius/sessions/:username/history`
- ` /admin/radius/sessions/reset`
- ` /admin/radius/sync`
- ` /admin/radius/sync/:id`
- ` /admin/radius/users/:username`
- ` /admin/settings/full-radius-mode`
- ` /finance/expense-categories`
- ` /finance/expense-categories/:id`
- ` /finance/expenses`
- ` /finance/expenses/:id`
- ` /finance/expenses/batch`
- ` /finance/rab-projects`
- ` /finance/rab-projects/:id`
- ` /finance/rab-projects/:id/actuals`
- ` /finance/rab-projects/:id/copy`
- ` /finance/rab-projects/:id/revision-profit-loss`
- ` /finance/rab-projects/:id/revisions`
- ` /finance/rab-projects/:id/revisions/:revisionId/submit`
- ` /finance/rab-projects/dashboard`
- ` /integrations/mixradius/accounts`
- ` /integrations/mixradius/accounts/:id`
- ` /integrations/mixradius/customers`
- ` /integrations/mixradius/customers/:id`
- ` /integrations/mixradius/dismantle`
- ` /integrations/mixradius/fees`
- ` /integrations/mixradius/groups`
- ` /integrations/mixradius/groups/:id`
- ` /integrations/mixradius/investor-sites`
- ` /integrations/mixradius/investor-sites/:id`
- ` /integrations/mixradius/invoice-counts`
- ` /integrations/mixradius/npl`
- ` /integrations/mixradius/odps`
- ` /integrations/mixradius/odps/:id/customers`
- ` /integrations/mixradius/owners`
- ` /integrations/mixradius/print/:id`
- ` /integrations/mixradius/profit-loss`
- ` /integrations/mixradius/reports/delete/:id`
- ` /integrations/mixradius/reports/period`
- ` /integrations/mixradius/sessions`
- ` /integrations/mixradius/sync`
- ` /integrations/mixradius/test`
- ` /mobile/mixradius/customers`
- ` /mobile/mixradius/groups`
- `POST /pelanggan-ppp/:id/activate`
- `POST /pelanggan-ppp/:id/suspend`
- `GET /pelanggan-ppp/:id/usage`
- `GET /settings/radius-defaults`

### MikroTik RouterOS (6 endpoints)

- ` /mikrotik-routers`
- ` /mikrotik-routers/:id`
- ` /mikrotik-routers/:id/generate-api-user`
- ` /mikrotik-routers/check-status`
- ` /mikrotik-routers/reconfigure`
- ` /mikrotik-routers/test-connection`


---

## 3. Authentication & Authorization

### Authentication Methods

- **customerAuth**: 13 endpoints
- **getServerSession**: 63 endpoints
- **requireAuth**: 7 endpoints

### Permission-Based Endpoints (1)

Endpoints requiring specific permissions:

#### Permission: `Gudang` (1 routes)
- `/inventory/gudang/:id`


---

## 4. API Categories Detail

### ADMIN (241 routes)

- **Authenticated**: 2/241
- **Public**: 239/241
- **With HTTP Methods Detected**: 19

#### Sample Endpoints:

- 🔓 `N/A` /admin/accel-ppp-servers
- 🔓 `N/A` /admin/accel-ppp-servers/:id
- 🔓 `N/A` /admin/accel-ppp-servers/:id/sessions
- 🔓 `N/A` /admin/accel-ppp-servers/:id/sessions/:username/kick
- 🔓 `N/A` /admin/accel-ppp-servers/:id/test-connection
- 🔓 `N/A` /admin/accounting/coa
- 🔓 `N/A` /admin/accounting/coa/:id
- 🔓 `N/A` /admin/accounting/coa/seed
- 🔓 `N/A` /admin/accounting/journal
- 🔓 `N/A` /admin/accounting/journal/:id


... and 231 more


### OTHER (238 routes)

- **Authenticated**: 68/238
- **Public**: 170/238
- **With HTTP Methods Detected**: 99

#### Sample Endpoints:

- 🔓 `N/A` /:[...route]
- 🔓 `N/A` /acs/devices
- 🔓 `N/A` /acs/devices/:id
- 🔓 `N/A` /acs/devices/:id/tasks
- 🔓 `N/A` /acs/devices/:id/wan
- 🔒 `GET, POST` /announcements
- 🔒 `PUT, DELETE` /announcements/:id
- 🔒 `GET, POST` /announcements/:id/read
- 🔓 `N/A` /attendance/analytics
- 🔒 `POST` /attendance/check-in


... and 228 more


### MOBILE (63 routes)

- **Authenticated**: 0/63
- **Public**: 63/63
- **With HTTP Methods Detected**: 24

#### Sample Endpoints:

- 🔓 `GET` /mobile/announcements
- 🔓 `POST` /mobile/announcements/:id/read
- 🔓 `GET` /mobile/app-update/asset
- 🔓 `GET` /mobile/app-update/manifest
- 🔓 `GET` /mobile/app-version/check
- 🔓 `N/A` /mobile/attendance/check-in
- 🔓 `N/A` /mobile/attendance/check-out
- 🔓 `N/A` /mobile/attendance/geofence
- 🔓 `N/A` /mobile/attendance/history
- 🔓 `N/A` /mobile/attendance/status


... and 53 more


### CRON (26 routes)

- **Authenticated**: 0/26
- **Public**: 26/26
- **With HTTP Methods Detected**: 26

#### Sample Endpoints:

- 🔓 `GET` /cron/accounting/health-check
- 🔓 `GET` /cron/accounting/recurring
- 🔓 `GET, POST` /cron/apply-pending-packages
- 🔓 `GET` /cron/ar-aging-snapshot
- 🔓 `GET` /cron/attendance-alert
- 🔓 `GET, POST` /cron/attendance-orchestrator
- 🔓 `GET, POST` /cron/auto-approve-leave
- 🔓 `GET, POST` /cron/auto-checkout
- 🔓 `GET` /cron/auto-reject-expired-leaves
- 🔓 `GET` /cron/cleanup-notification-logs


... and 16 more


### CUSTOMER (19 routes)

- **Authenticated**: 13/19
- **Public**: 6/19
- **With HTTP Methods Detected**: 18

#### Sample Endpoints:

- 🔒 `POST` /customer/announcements/:id/read
- 🔓 `POST` /customer/auth/login
- 🔓 `POST` /customer/auth/logout
- 🔒 `GET` /customer/auth/me
- 🔒 `GET` /customer/dashboard/summary
- 🔒 `GET` /customer/invoices
- 🔒 `GET` /customer/notifications
- 🔒 `GET` /customer/notifications/unread-count
- 🔒 `GET` /customer/package
- 🔒 `GET` /customer/payment-methods


... and 9 more


### INVESTOR (7 routes)

- **Authenticated**: 0/7
- **Public**: 7/7
- **With HTTP Methods Detected**: 7

#### Sample Endpoints:

- 🔓 `POST` /investor/auth/login
- 🔓 `POST` /investor/auth/logout
- 🔓 `GET` /investor/auth/session
- 🔓 `GET` /investor/dashboard
- 🔓 `GET` /investor/payouts
- 🔓 `GET` /investor/projects
- 🔓 `GET` /investor/projects/:id



### PUBLIC (4 routes)

- **Authenticated**: 0/4
- **Public**: 4/4
- **With HTTP Methods Detected**: 3

#### Sample Endpoints:

- 🔓 `GET` /public/captcha-settings
- 🔓 `N/A` /public/landing-content
- 🔓 `GET` /public/registration-status/:id
- 🔓 `GET` /public/status



### WEBHOOKS (1 routes)

- **Authenticated**: 0/1
- **Public**: 1/1
- **With HTTP Methods Detected**: 1

#### Sample Endpoints:

- 🔓 `POST` /webhooks/:provider



---

## 5. Service Layer Usage

Module services used across API routes:



---

## 6. Endpoint Inventory by Category

### ADMIN

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/admin/accel-ppp-servers` | - | ✗ | - | - |
| `/admin/accel-ppp-servers/:id` | - | ✗ | - | - |
| `/admin/accel-ppp-servers/:id/sessions` | - | ✗ | - | - |
| `/admin/accel-ppp-servers/:id/sessions/:username/kick` | - | ✗ | - | - |
| `/admin/accel-ppp-servers/:id/test-connection` | - | ✗ | - | - |
| `/admin/accounting/coa` | - | ✗ | - | - |
| `/admin/accounting/coa/:id` | - | ✗ | - | - |
| `/admin/accounting/coa/seed` | - | ✗ | - | - |
| `/admin/accounting/journal` | - | ✗ | - | - |
| `/admin/accounting/journal/:id` | - | ✗ | - | - |
| `/admin/accounting/journal/:id/reverse` | - | ✗ | - | - |
| `/admin/accounting/journal/opening-balance` | - | ✗ | - | - |
| `/admin/accounting/period` | - | ✗ | - | - |
| `/admin/accounting/period/:id/close` | - | ✗ | - | - |
| `/admin/accounting/period/:id/reopen` | - | ✗ | - | - |
| `/admin/accounting/reconciliation` | - | ✗ | - | - |
| `/admin/accounting/reconciliation/:id` | - | ✗ | - | - |
| `/admin/accounting/reconciliation/:id/complete` | - | ✗ | - | - |
| `/admin/accounting/reconciliation/:id/match` | - | ✗ | - | - |
| `/admin/accounting/recurring` | - | ✗ | - | - |
| `/admin/accounting/recurring/:id` | - | ✗ | - | - |
| `/admin/accounting/reports/balance-sheet` | - | ✗ | - | - |
| `/admin/accounting/reports/cash-book` | - | ✗ | - | - |
| `/admin/accounting/reports/cash-flow` | - | ✗ | - | - |
| `/admin/accounting/reports/general-ledger` | - | ✗ | - | - |
| `/admin/accounting/reports/profit-loss` | - | ✗ | - | - |
| `/admin/accounting/reports/trial-balance` | - | ✗ | - | - |
| `/admin/app-releases` | GET, POST | ✓ (getServerSession) | - | - |
| `/admin/app-releases/:id` | GET, PATCH, DELETE | ✗ | - | - |
| `/admin/app-update` | - | ✗ | - | - |
| `/admin/app-update/:id` | - | ✗ | - | - |
| `/admin/app-update/contact-settings` | - | ✗ | - | - |
| `/admin/app-update/publish` | POST | ✗ | - | - |
| `/admin/attendance` | - | ✗ | - | - |
| `/admin/attendance/:id` | - | ✗ | - | - |
| `/admin/attendance/:id/correct-missed-checkin` | - | ✗ | - | - |
| `/admin/attendance/backdate` | - | ✗ | - | - |
| `/admin/attendance/recompute` | - | ✗ | - | - |
| `/admin/attendance/settings` | - | ✗ | - | - |
| `/admin/chat/broadcast` | - | ✗ | - | - |
| `/admin/chat/conversations` | - | ✗ | - | - |
| `/admin/chat/conversations/:id` | - | ✗ | - | - |
| `/admin/chat/global` | - | ✗ | - | - |
| `/admin/chat/users` | - | ✗ | - | - |
| `/admin/company-bank-accounts` | - | ✗ | - | - |
| `/admin/company-bank-accounts/:id` | - | ✗ | - | - |
| `/admin/coupons/analytics` | - | ✗ | - | - |
| `/admin/departments` | - | ✗ | - | - |
| `/admin/departments/:id` | - | ✗ | - | - |
| `/admin/event-bus/health` | GET | ✗ | - | - |
| `/admin/finance/ar-aging` | - | ✗ | - | - |
| `/admin/finance/customer-cohort` | - | ✗ | - | - |
| `/admin/finance/revenue-snapshot` | - | ✗ | - | - |
| `/admin/holidays` | - | ✗ | - | - |
| `/admin/holidays/:id` | - | ✗ | - | - |
| `/admin/incidents` | - | ✗ | - | - |
| `/admin/incidents/:id` | - | ✗ | - | - |
| `/admin/incidents/analytics` | - | ✗ | - | - |
| `/admin/integrations/mixradius/sync` | - | ✗ | - | - |
| `/admin/investors` | - | ✗ | - | - |
| `/admin/investors/:id` | - | ✗ | - | - |
| `/admin/investors/:id/balance` | - | ✗ | - | - |
| `/admin/investors/:id/config` | - | ✗ | - | - |
| `/admin/investors/:id/deposits` | - | ✗ | - | - |
| `/admin/investors/:id/detail` | - | ✗ | - | - |
| `/admin/investors/:id/payouts` | - | ✗ | - | - |
| `/admin/investors/:id/profit-shares` | - | ✗ | - | - |
| `/admin/investors/deposits` | - | ✗ | - | - |
| `/admin/investors/deposits/:depositId/complete` | - | ✗ | - | - |
| `/admin/investors/deposits/:depositId/reject` | - | ✗ | - | - |
| `/admin/investors/deposits/:depositId/verify` | - | ✗ | - | - |
| `/admin/investors/profit-shares` | - | ✗ | - | - |
| `/admin/investors/profit-shares/:shareId/approve` | - | ✗ | - | - |
| `/admin/investors/profit-shares/:shareId/pay` | - | ✗ | - | - |
| `/admin/investors/profit-shares/calculate` | - | ✗ | - | - |
| `/admin/invoices/:id/void` | - | ✗ | - | - |
| `/admin/leave-balance` | GET, POST | ✗ | - | - |
| `/admin/leaves` | - | ✗ | - | - |
| `/admin/leaves/:id` | - | ✗ | - | - |
| `/admin/lembur` | - | ✗ | - | - |
| `/admin/lembur/:id` | - | ✗ | - | - |
| `/admin/location/history/:userId` | - | ✗ | - | - |
| `/admin/location/live` | - | ✗ | - | - |
| `/admin/marketing/sales` | - | ✗ | - | - |
| `/admin/marketing/sales-dashboard` | GET | ✗ | - | - |
| `/admin/mitra` | - | ✗ | - | - |
| `/admin/mitra/:id` | - | ✗ | - | - |
| `/admin/mitra/:id/face-verifications` | - | ✗ | - | - |
| `/admin/mitra/:id/wallet` | - | ✗ | - | - |
| `/admin/mitra/sync-commissions` | - | ✗ | - | - |
| `/admin/mitra/withdrawals` | - | ✗ | - | - |
| `/admin/mitra/withdrawals/:id` | - | ✗ | - | - |
| `/admin/notifications/dead-letter` | - | ✗ | - | - |
| `/admin/notifications/dead-letter/:id/resolve` | - | ✗ | - | - |
| `/admin/notifications/dead-letter/:id/retry` | - | ✗ | - | - |
| `/admin/notifications/email-logs` | - | ✗ | - | - |
| `/admin/notifications/monitoring` | - | ✗ | - | - |
| `/admin/options` | - | ✗ | - | - |
| `/admin/payment-gateway/configs` | - | ✗ | - | - |
| `/admin/payment-gateway/configs/:provider` | - | ✗ | - | - |
| `/admin/payment-gateway/test` | - | ✗ | - | - |
| `/admin/payments/:id/cancel` | - | ✗ | - | - |
| `/admin/payments/pending-manual` | GET | ✗ | - | - |
| `/admin/payments/verify-manual` | - | ✗ | - | - |
| `/admin/pelanggan/:id/invoices` | - | ✗ | - | - |
| `/admin/pelanggan/:id/notification-history` | - | ✗ | - | - |
| `/admin/pelanggan/:id/prorate-log` | - | ✗ | - | - |
| `/admin/procurement/approval-thresholds` | - | ✗ | - | - |
| `/admin/procurement/approval-thresholds/:id` | - | ✗ | - | - |
| `/admin/procurement/goods-receipts` | - | ✗ | - | - |
| `/admin/procurement/goods-receipts/:id` | - | ✗ | - | - |
| `/admin/procurement/goods-returns` | - | ✗ | - | - |
| `/admin/procurement/goods-returns/:id` | - | ✗ | - | - |
| `/admin/procurement/purchase-orders` | - | ✗ | - | - |
| `/admin/procurement/purchase-orders/:id` | - | ✗ | - | - |
| `/admin/procurement/purchase-orders/:id/process` | - | ✗ | - | - |
| `/admin/procurement/purchase-orders/from-pr` | - | ✗ | - | - |
| `/admin/procurement/purchase-requests` | - | ✗ | - | - |
| `/admin/procurement/suppliers` | - | ✗ | - | - |
| `/admin/procurement/suppliers/:id` | - | ✗ | - | - |
| `/admin/profile` | - | ✗ | - | - |
| `/admin/profile/photo` | - | ✗ | - | - |
| `/admin/radius/accounting/:username` | - | ✗ | - | - |
| `/admin/radius/dashboard/recent-sessions` | - | ✗ | - | - |
| `/admin/radius/dashboard/stats` | - | ✗ | - | - |
| `/admin/radius/debug/live-usage` | - | ✗ | - | - |
| `/admin/radius/ippool` | - | ✗ | - | - |
| `/admin/radius/ippool/:ipAddress` | - | ✗ | - | - |
| `/admin/radius/nas` | - | ✗ | - | - |
| `/admin/radius/nas/:id` | - | ✗ | - | - |
| `/admin/radius/orphans` | - | ✗ | - | - |
| `/admin/radius/sessions` | - | ✗ | - | - |
| `/admin/radius/sessions/:username/history` | - | ✗ | - | - |
| `/admin/radius/sessions/reset` | - | ✗ | - | - |
| `/admin/radius/sync` | - | ✗ | - | - |
| `/admin/radius/sync/:id` | - | ✗ | - | - |
| `/admin/radius/users/:username` | - | ✗ | - | - |
| `/admin/registrations` | - | ✗ | - | - |
| `/admin/registrations/:id` | - | ✗ | - | - |
| `/admin/reports/presence` | - | ✗ | - | - |
| `/admin/resellers` | - | ✗ | - | - |
| `/admin/resellers/:id` | - | ✗ | - | - |
| `/admin/resellers/:id/commissions` | - | ✗ | - | - |
| `/admin/resellers/:id/outlets` | - | ✗ | - | - |
| `/admin/resellers/:id/outlets/:outletId` | - | ✗ | - | - |
| `/admin/resellers/:id/package-prices` | - | ✗ | - | - |
| `/admin/resellers/:id/settlements` | - | ✗ | - | - |
| `/admin/salary/advances` | - | ✗ | - | - |
| `/admin/salary/advances/:id` | - | ✗ | - | - |
| `/admin/salary/components` | - | ✗ | - | - |
| `/admin/salary/components/:id` | - | ✗ | - | - |
| `/admin/salary/config` | - | ✗ | - | - |
| `/admin/salary/profiles` | - | ✗ | - | - |
| `/admin/salary/profiles/:userId` | - | ✗ | - | - |
| `/admin/salary/profiles/:userId/components` | - | ✗ | - | - |
| `/admin/salary/runs` | - | ✗ | - | - |
| `/admin/salary/runs/:id` | - | ✗ | - | - |
| `/admin/salary/runs/:id/calculate` | - | ✗ | - | - |
| `/admin/settings/email` | - | ✗ | - | - |
| `/admin/settings/email/test` | - | ✗ | - | - |
| `/admin/settings/full-radius-mode` | - | ✗ | - | - |
| `/admin/shifts` | GET, POST | ✗ | - | - |
| `/admin/shifts/:id` | GET, PATCH, DELETE | ✗ | - | - |
| `/admin/sites` | - | ✗ | - | - |
| `/admin/sites/:id` | - | ✗ | - | - |
| `/admin/support-tickets` | - | ✗ | - | - |
| `/admin/support-tickets/:id` | - | ✗ | - | - |
| `/admin/support-tickets/:id/reply` | - | ✗ | - | - |
| `/admin/support-tickets/unread-count` | - | ✗ | - | - |
| `/admin/system-logs` | GET | ✗ | - | - |
| `/admin/tax/config` | - | ✗ | - | - |
| `/admin/tax/export/bhp-uso` | - | ✗ | - | - |
| `/admin/tax/export/pph21` | - | ✗ | - | - |
| `/admin/tax/export/ppn` | - | ✗ | - | - |
| `/admin/tax/period` | - | ✗ | - | - |
| `/admin/tax/period/:year/:month` | - | ✗ | - | - |
| `/admin/tax/period/:year/:month/lock` | - | ✗ | - | - |
| `/admin/tax/period/:year/:month/mark-paid` | - | ✗ | - | - |
| `/admin/tax/rate-configs` | - | ✗ | - | - |
| `/admin/tax/rate-configs/:id` | - | ✗ | - | - |
| `/admin/tax/transactions` | - | ✗ | - | - |
| `/admin/tenant-domains` | - | ✗ | - | - |
| `/admin/tenant-domains/:id/disable` | - | ✗ | - | - |
| `/admin/tenant-domains/:id/verify` | - | ✗ | - | - |
| `/admin/tenants` | - | ✗ | - | - |
| `/admin/tenants/:id` | PUT, DELETE | ✓ (getServerSession) | - | - |
| `/admin/tenants/:id/domains` | - | ✗ | - | - |
| `/admin/tenants/:id/domains/:domainId` | - | ✗ | - | - |
| `/admin/tenants/:id/domains/:domainId/verify` | - | ✗ | - | - |
| `/admin/tenants/:id/feature-flags` | - | ✗ | - | - |
| `/admin/users` | - | ✗ | - | - |
| `/admin/users/:id` | - | ✗ | - | - |
| `/admin/users/:id/force-logout` | - | ✗ | - | - |
| `/admin/users/:id/performance` | - | ✗ | - | - |
| `/admin/users/:id/sales-performance` | - | ✗ | - | - |
| `/admin/users/check-identifier` | - | ✗ | - | - |
| `/admin/website/faq` | - | ✗ | - | - |
| `/admin/website/faq/:id` | - | ✗ | - | - |
| `/admin/website/features` | - | ✗ | - | - |
| `/admin/website/features/:id` | - | ✗ | - | - |
| `/admin/website/footer` | - | ✗ | - | - |
| `/admin/website/hero` | - | ✗ | - | - |
| `/admin/website/pricing` | - | ✗ | - | - |
| `/admin/website/pricing/:id` | - | ✗ | - | - |
| `/admin/website/testimonials` | - | ✗ | - | - |
| `/admin/website/testimonials/:id` | - | ✗ | - | - |
| `/admin/website/upload-logo` | - | ✗ | - | - |
| `/admin/whatsapp/accounts` | GET, POST | ✗ | - | - |
| `/admin/whatsapp/accounts/:id` | GET, PATCH, DELETE | ✗ | - | - |
| `/admin/whatsapp/accounts/:id/baileys` | GET, POST | ✗ | - | - |
| `/admin/whatsapp/accounts/:id/set-default` | POST | ✗ | - | - |
| `/admin/whatsapp/accounts/:id/test` | POST | ✗ | - | - |
| `/admin/whatsapp/messages` | GET | ✗ | - | - |
| `/admin/whatsapp/messages/:id` | GET | ✗ | - | - |
| `/admin/whatsapp/stats` | GET | ✗ | - | - |
| `/admin/workorders` | - | ✗ | - | - |
| `/admin/workorders/:id` | - | ✗ | - | - |
| `/admin/workorders/:id/approve` | - | ✗ | - | - |
| `/admin/workorders/:id/assign` | - | ✗ | - | - |
| `/admin/workorders/:id/attachments` | - | ✗ | - | - |
| `/admin/workorders/:id/attachments/:attachmentId` | - | ✗ | - | - |
| `/admin/workorders/:id/comments` | - | ✗ | - | - |
| `/admin/workorders/:id/material-detail` | - | ✗ | - | - |
| `/admin/workorders/:id/materials` | - | ✗ | - | - |
| `/admin/workorders/:id/reminder` | - | ✗ | - | - |
| `/admin/workorders/:id/tasks` | - | ✗ | - | - |
| `/admin/workorders/analytics` | - | ✗ | - | - |
| `/admin/workorders/dashboard` | - | ✗ | - | - |
| `/admin/workorders/department-workload` | - | ✗ | - | - |
| `/admin/workorders/escalations` | - | ✗ | - | - |
| `/admin/workorders/escalations/:id` | - | ✗ | - | - |
| `/admin/workorders/recent` | - | ✗ | - | - |
| `/admin/workorders/requests` | - | ✗ | - | - |
| `/admin/workorders/response-stats` | - | ✗ | - | - |
| `/admin/workorders/slas` | - | ✗ | - | - |
| `/admin/workorders/slas/:id` | - | ✗ | - | - |
| `/admin/workorders/stats` | - | ✗ | - | - |
| `/admin/workorders/templates` | - | ✗ | - | - |
| `/admin/workorders/templates/:id` | - | ✗ | - | - |
| `/admin/workorders/top-performers` | - | ✗ | - | - |
| `/admin/workorders/trends` | - | ✗ | - | - |


### CRON

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/cron/accounting/health-check` | GET | ✗ | - | - |
| `/cron/accounting/recurring` | GET | ✗ | - | - |
| `/cron/apply-pending-packages` | GET, POST | ✗ | - | - |
| `/cron/ar-aging-snapshot` | GET | ✗ | - | - |
| `/cron/attendance-alert` | GET | ✗ | - | - |
| `/cron/attendance-orchestrator` | GET, POST | ✗ | - | - |
| `/cron/auto-approve-leave` | GET, POST | ✗ | - | - |
| `/cron/auto-checkout` | GET, POST | ✗ | - | - |
| `/cron/auto-reject-expired-leaves` | GET | ✗ | - | - |
| `/cron/cleanup-notification-logs` | GET | ✗ | - | - |
| `/cron/cleanup-stale-fcm-tokens` | GET | ✗ | - | - |
| `/cron/customer-cohort` | GET | ✗ | - | - |
| `/cron/depreciation` | GET | ✗ | - | - |
| `/cron/olt-discovery` | POST | ✗ | - | - |
| `/cron/olt-monitoring` | POST | ✗ | - | - |
| `/cron/process-absence` | GET, POST | ✗ | - | - |
| `/cron/process-overdue` | GET, POST | ✗ | - | - |
| `/cron/rab-status-eval` | GET, POST | ✗ | - | - |
| `/cron/reconcile-billing-schedules` | GET, POST | ✗ | - | - |
| `/cron/revenue-snapshot` | GET | ✗ | - | - |
| `/cron/send-leave-reminders` | GET | ✗ | - | - |
| `/cron/tax/bhp-uso` | GET | ✗ | - | - |
| `/cron/tax/reminder` | GET | ✗ | - | - |
| `/cron/tenant-domain-verify` | GET, POST | ✗ | - | - |
| `/cron/workorder-reminder` | GET | ✗ | - | - |
| `/cron/workorder-sla-monitor` | GET | ✗ | - | - |


### CUSTOMER

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/customer/announcements/:id/read` | POST | ✓ (customerAuth) | - | - |
| `/customer/auth/login` | POST | ✗ | - | - |
| `/customer/auth/logout` | POST | ✗ | - | - |
| `/customer/auth/me` | GET | ✓ (customerAuth) | - | - |
| `/customer/dashboard/summary` | GET | ✓ (customerAuth) | - | - |
| `/customer/invoices` | GET | ✓ (customerAuth) | - | - |
| `/customer/notifications` | GET | ✓ (customerAuth) | - | - |
| `/customer/notifications/unread-count` | GET | ✓ (customerAuth) | - | - |
| `/customer/package` | GET | ✓ (customerAuth) | - | - |
| `/customer/payment-methods` | GET | ✓ (customerAuth) | - | - |
| `/customer/payments` | GET, POST | ✓ (customerAuth) | - | - |
| `/customer/payments/sse` | GET | ✓ (customerAuth) | - | - |
| `/customer/payments/upload-receipt` | POST | ✓ (customerAuth) | - | - |
| `/customer/profile` | GET, PATCH | ✓ (customerAuth) | - | - |
| `/customer/tickets` | - | ✗ | - | - |
| `/customer/tickets/:id` | GET | ✗ | - | - |
| `/customer/tickets/:id/close` | POST | ✗ | - | - |
| `/customer/tickets/:id/reply` | POST | ✗ | - | - |
| `/customer/usage` | GET | ✓ (customerAuth) | - | - |


### INVESTOR

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/investor/auth/login` | POST | ✗ | - | - |
| `/investor/auth/logout` | POST | ✗ | - | - |
| `/investor/auth/session` | GET | ✗ | - | - |
| `/investor/dashboard` | GET | ✗ | - | - |
| `/investor/payouts` | GET | ✗ | - | - |
| `/investor/projects` | GET | ✗ | - | - |
| `/investor/projects/:id` | GET | ✗ | - | - |


### MOBILE

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/mobile/announcements` | GET | ✗ | - | - |
| `/mobile/announcements/:id/read` | POST | ✗ | - | - |
| `/mobile/app-update/asset` | GET | ✗ | - | - |
| `/mobile/app-update/manifest` | GET | ✗ | - | - |
| `/mobile/app-version/check` | GET | ✗ | - | - |
| `/mobile/attendance/check-in` | - | ✗ | - | - |
| `/mobile/attendance/check-out` | - | ✗ | - | - |
| `/mobile/attendance/geofence` | - | ✗ | - | - |
| `/mobile/attendance/history` | - | ✗ | - | - |
| `/mobile/attendance/status` | - | ✗ | - | - |
| `/mobile/auth/firebase-token` | POST | ✗ | - | - |
| `/mobile/auth/login` | POST | ✗ | - | - |
| `/mobile/auth/logout` | POST | ✗ | - | - |
| `/mobile/auth/me` | GET | ✗ | - | - |
| `/mobile/auth/refresh` | POST | ✗ | - | - |
| `/mobile/chat/conversations` | - | ✗ | - | - |
| `/mobile/chat/conversations/:id` | - | ✗ | - | - |
| `/mobile/chat/global` | - | ✗ | - | - |
| `/mobile/chat/upload` | - | ✗ | - | - |
| `/mobile/chat/users` | - | ✗ | - | - |
| `/mobile/dashboard` | - | ✗ | - | - |
| `/mobile/departments` | GET | ✗ | - | - |
| `/mobile/error-report` | POST | ✗ | - | - |
| `/mobile/fcm-token` | POST | ✗ | - | - |
| `/mobile/geofence` | - | ✗ | - | - |
| `/mobile/holidays` | - | ✗ | - | - |
| `/mobile/inventory/barang` | - | ✗ | - | - |
| `/mobile/inventory/gudang` | - | ✗ | - | - |
| `/mobile/inventory/keluar` | - | ✗ | - | - |
| `/mobile/inventory/masuk` | - | ✗ | - | - |
| `/mobile/inventory/riwayat` | - | ✗ | - | - |
| `/mobile/leaves` | - | ✗ | - | - |
| `/mobile/location` | POST | ✗ | - | - |
| `/mobile/mitra/dashboard` | GET | ✗ | - | - |
| `/mobile/mitra/fcm-token` | POST | ✗ | - | - |
| `/mobile/mitra/verify-face` | POST | ✗ | - | - |
| `/mobile/mitra/wallet` | GET | ✗ | - | - |
| `/mobile/mitra/withdraw` | GET, POST | ✗ | - | - |
| `/mobile/mixradius/customers` | - | ✗ | - | - |
| `/mobile/mixradius/groups` | - | ✗ | - | - |
| `/mobile/notifications` | - | ✗ | - | - |
| `/mobile/overtime` | - | ✗ | - | - |
| `/mobile/partners` | - | ✗ | - | - |
| `/mobile/ping` | GET | ✗ | - | - |
| `/mobile/profile` | GET, PATCH | ✗ | - | - |
| `/mobile/profile/password` | POST | ✗ | - | - |
| `/mobile/profile/photo` | POST | ✗ | - | - |
| `/mobile/push-token` | POST, DELETE | ✗ | - | - |
| `/mobile/salary` | - | ✗ | - | - |
| `/mobile/salary/:id` | - | ✗ | - | - |
| `/mobile/salary/advances` | - | ✗ | - | - |
| `/mobile/topology` | - | ✗ | - | - |
| `/mobile/upload` | - | ✗ | - | - |
| `/mobile/work-orders` | - | ✗ | - | - |
| `/mobile/work-orders/:id` | - | ✗ | - | - |
| `/mobile/work-orders/:id/materials` | - | ✗ | - | - |
| `/mobile/work-orders/:id/partner-response` | - | ✗ | - | - |
| `/mobile/work-orders/:id/partners` | - | ✗ | - | - |
| `/mobile/work-orders/:id/return` | - | ✗ | - | - |
| `/mobile/work-orders/:id/tasks` | - | ✗ | - | - |
| `/mobile/work-orders/:id/update` | - | ✗ | - | - |
| `/mobile/work-orders/available` | - | ✗ | - | - |
| `/mobile/work-orders/request` | - | ✗ | - | - |


### OTHER

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/:[...route]` | - | ✗ | - | - |
| `/acs/devices` | - | ✗ | - | - |
| `/acs/devices/:id` | - | ✗ | - | - |
| `/acs/devices/:id/tasks` | - | ✗ | - | - |
| `/acs/devices/:id/wan` | - | ✗ | - | - |
| `/announcements` | GET, POST | ✓ (requireAuth) | - | - |
| `/announcements/:id` | PUT, DELETE | ✓ (requireAuth) | - | - |
| `/announcements/:id/read` | GET, POST | ✓ (requireAuth) | - | - |
| `/attendance/analytics` | - | ✗ | - | - |
| `/attendance/check-in` | POST | ✓ (getServerSession) | - | - |
| `/attendance/check-out` | POST | ✓ (getServerSession) | - | - |
| `/attendance/config` | - | ✗ | - | - |
| `/attendance/history` | - | ✗ | - | - |
| `/attendance/status` | - | ✗ | - | - |
| `/auth/:...nextauth` | - | ✗ | - | - |
| `/auth/firebase-token` | POST | ✓ (getServerSession) | - | - |
| `/bandwidths` | GET, POST | ✓ (getServerSession) | - | - |
| `/bandwidths/:id` | GET, PUT, DELETE | ✓ (requireAuth) | - | - |
| `/billing/analytics` | - | ✗ | - | - |
| `/coupons` | - | ✗ | - | - |
| `/coupons/:id` | - | ✗ | - | - |
| `/coupons/verify` | - | ✗ | - | - |
| `/docs` | GET | ✗ | - | - |
| `/finance/accounts` | - | ✗ | - | - |
| `/finance/expense-categories` | - | ✗ | - | - |
| `/finance/expense-categories/:id` | - | ✗ | - | - |
| `/finance/expenses` | - | ✗ | - | - |
| `/finance/expenses/:id` | - | ✗ | - | - |
| `/finance/expenses/batch` | - | ✗ | - | - |
| `/finance/pay-po` | - | ✗ | - | - |
| `/finance/rab-projects` | - | ✗ | - | - |
| `/finance/rab-projects/:id` | - | ✗ | - | - |
| `/finance/rab-projects/:id/actuals` | - | ✗ | - | - |
| `/finance/rab-projects/:id/copy` | - | ✗ | - | - |
| `/finance/rab-projects/:id/revision-profit-loss` | - | ✗ | - | - |
| `/finance/rab-projects/:id/revisions` | - | ✗ | - | - |
| `/finance/rab-projects/:id/revisions/:revisionId` | - | ✗ | - | - |
| `/finance/rab-projects/:id/revisions/:revisionId/submit` | - | ✗ | - | - |
| `/finance/rab-projects/dashboard` | - | ✗ | - | - |
| `/finance/stats` | - | ✗ | - | - |
| `/finance/transfer` | - | ✗ | - | - |
| `/finance/unmatched-mutations` | - | ✗ | - | - |
| `/hargapakets` | - | ✗ | - | - |
| `/hargapakets/:id` | - | ✗ | - | - |
| `/health` | GET | ✗ | - | - |
| `/health/memory` | GET | ✗ | - | - |
| `/health/time` | GET | ✓ (getServerSession) | - | - |
| `/integrations/market-price` | - | ✗ | - | - |
| `/integrations/mixradius/accounts` | - | ✗ | - | - |
| `/integrations/mixradius/accounts/:id` | - | ✗ | - | - |
| `/integrations/mixradius/customers` | - | ✗ | - | - |
| `/integrations/mixradius/customers/:id` | - | ✗ | - | - |
| `/integrations/mixradius/dismantle` | - | ✗ | - | - |
| `/integrations/mixradius/expenses/rab/:id/approve` | POST | ✓ (getServerSession) | - | - |
| `/integrations/mixradius/expenses/rab/:id/reminder` | - | ✗ | - | - |
| `/integrations/mixradius/expenses/rab/:id/revisions/:revisionId/approve` | POST | ✓ (getServerSession) | - | - |
| `/integrations/mixradius/expenses/rab/:id/revisions/:revisionId/reject` | POST | ✓ (getServerSession) | - | - |
| `/integrations/mixradius/fees` | - | ✗ | - | - |
| `/integrations/mixradius/groups` | - | ✗ | - | - |
| `/integrations/mixradius/groups/:id` | - | ✗ | - | - |
| `/integrations/mixradius/investor-sites` | - | ✗ | - | - |
| `/integrations/mixradius/investor-sites/:id` | - | ✗ | - | - |
| `/integrations/mixradius/invoice-counts` | - | ✗ | - | - |
| `/integrations/mixradius/npl` | - | ✗ | - | - |
| `/integrations/mixradius/odps` | - | ✗ | - | - |
| `/integrations/mixradius/odps/:id/customers` | - | ✗ | - | - |
| `/integrations/mixradius/owners` | - | ✗ | - | - |
| `/integrations/mixradius/print/:id` | - | ✗ | - | - |
| `/integrations/mixradius/profit-loss` | - | ✗ | - | - |
| `/integrations/mixradius/reports/delete/:id` | - | ✗ | - | - |
| `/integrations/mixradius/reports/period` | - | ✗ | - | - |
| `/integrations/mixradius/sessions` | - | ✗ | - | - |
| `/integrations/mixradius/sync` | - | ✗ | - | - |
| `/integrations/mixradius/test` | - | ✗ | - | - |
| `/internal/whatsapp/send` | POST | ✗ | - | - |
| `/inventory/analytics/usage` | GET | ✓ (getServerSession) | - | - |
| `/inventory/assets` | GET, POST | ✓ (getServerSession) | - | - |
| `/inventory/assets/:id` | GET, PATCH | ✓ (getServerSession) | - | - |
| `/inventory/assets/:id/depreciate` | POST | ✓ (getServerSession) | - | - |
| `/inventory/barang` | - | ✗ | - | - |
| `/inventory/barang/:id` | - | ✗ | - | - |
| `/inventory/barang/stock` | GET | ✓ (getServerSession) | - | - |
| `/inventory/barang/stock/by-kondisi` | GET | ✗ | - | - |
| `/inventory/dashboard` | GET | ✗ | - | - |
| `/inventory/gudang` | - | ✗ | - | - |
| `/inventory/gudang/:id` | - | ✗ | Gudang | - |
| `/inventory/jasa` | GET, POST | ✓ (getServerSession) | - | - |
| `/inventory/jasa/:id` | GET, PUT, DELETE | ✓ (getServerSession) | - | - |
| `/inventory/keluar` | - | ✗ | - | - |
| `/inventory/keluar/:id` | GET, PUT, DELETE | ✓ (getServerSession) | - | - |
| `/inventory/masuk` | - | ✗ | - | - |
| `/inventory/masuk/:id` | - | ✗ | - | - |
| `/inventory/opname` | - | ✗ | - | - |
| `/inventory/opname/:id` | - | ✗ | - | - |
| `/inventory/opname/batch` | - | ✗ | - | - |
| `/inventory/opname/calculate` | - | ✗ | - | - |
| `/inventory/opname/history-stats` | - | ✗ | - | - |
| `/inventory/opname/list` | - | ✗ | - | - |
| `/inventory/opname/report` | - | ✗ | - | - |
| `/inventory/opname/summary` | - | ✗ | - | - |
| `/inventory/restock/alerts` | - | ✗ | - | - |
| `/inventory/restock/prediction` | GET | ✓ (getServerSession) | - | - |
| `/inventory/restock/requests` | GET, POST | ✓ (getServerSession) | - | - |
| `/inventory/restock/requests/:id` | GET, PUT, PATCH, DELETE | ✓ (getServerSession) | - | - |
| `/inventory/restock/requests/:id/approve` | PATCH | ✓ (getServerSession) | - | - |
| `/inventory/restock/requests/:id/process` | - | ✗ | - | - |
| `/inventory/restock/requests/:id/receive` | - | ✗ | - | - |
| `/inventory/restock/requests/:id/receive-jasa` | - | ✗ | - | - |
| `/inventory/restock/settings` | - | ✗ | - | - |
| `/inventory/stats` | GET | ✗ | - | - |
| `/inventory/transfer` | - | ✗ | - | - |
| `/inventory/transfer/:id` | - | ✗ | - | - |
| `/inventory/upload-photo` | GET, POST | ✗ | - | - |
| `/invoices` | - | ✗ | - | - |
| `/invoices/:id` | - | ✗ | - | - |
| `/invoices/:id/send` | - | ✗ | - | - |
| `/ip-info` | GET | ✗ | - | - |
| `/ktp-ocr` | POST | ✗ | - | - |
| `/map/edges` | - | ✗ | - | - |
| `/map/edges/:edgeId` | - | ✗ | - | - |
| `/map/import/csv` | - | ✗ | - | - |
| `/map/nodes` | - | ✗ | - | - |
| `/map/nodes/:nodeId` | - | ✗ | - | - |
| `/map/reset` | - | ✗ | - | - |
| `/map/settings` | - | ✗ | - | - |
| `/map/statistics` | - | ✗ | - | - |
| `/map/sync` | - | ✗ | - | - |
| `/map/upload` | - | ✗ | - | - |
| `/marketing/canvasing` | GET, POST | ✗ | - | - |
| `/marketing/canvasing/:id` | GET, PUT, PATCH, DELETE | ✗ | - | - |
| `/marketing/canvasing/:id/approve` | POST | ✗ | - | - |
| `/marketing/canvasing/:id/claim` | GET, POST | ✗ | - | - |
| `/marketing/canvasing/:id/reject` | POST | ✗ | - | - |
| `/marketing/canvasing/summary` | GET | ✗ | - | - |
| `/marketing/claims/cashout` | POST | ✗ | - | - |
| `/marketing/point-claims` | GET | ✗ | - | - |
| `/marketing/point-claims/:id` | GET, PUT, DELETE | ✗ | - | - |
| `/marketing/point-claims/summary` | GET | ✗ | - | - |
| `/marketing/test-canvasing` | GET | ✗ | - | - |
| `/mikrotik-routers` | - | ✗ | - | - |
| `/mikrotik-routers/:id` | - | ✗ | - | - |
| `/mikrotik-routers/:id/generate-api-user` | - | ✗ | - | - |
| `/mikrotik-routers/check-status` | - | ✗ | - | - |
| `/mikrotik-routers/reconfigure` | - | ✗ | - | - |
| `/mikrotik-routers/test-connection` | - | ✗ | - | - |
| `/network/alerts` | - | ✗ | - | - |
| `/network/alerts/:id` | - | ✗ | - | - |
| `/network/backups` | - | ✗ | - | - |
| `/network/backups/:id` | - | ✗ | - | - |
| `/network/backups/:id/restore` | - | ✗ | - | - |
| `/network/performance` | - | ✗ | - | - |
| `/network/performance/:id` | - | ✗ | - | - |
| `/network/performance/:id/history` | - | ✗ | - | - |
| `/notifications` | - | ✗ | - | - |
| `/notifications/:id` | - | ✗ | - | - |
| `/notifications/:id/read` | - | ✗ | - | - |
| `/notifications/unread-count` | - | ✗ | - | - |
| `/odcs/locations` | GET | ✗ | - | - |
| `/odps` | - | ✗ | - | - |
| `/olt/alerts` | GET | ✓ (getServerSession) | - | - |
| `/olt/bandwidth-profiles` | GET, POST | ✓ (getServerSession) | - | - |
| `/olt/bandwidth-profiles/:id` | GET, PATCH, DELETE | ✓ (getServerSession) | - | - |
| `/olt/command-logs` | GET | ✓ (getServerSession) | - | - |
| `/olt/devices` | GET, POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id` | GET, PATCH, DELETE | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/cards` | GET | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/cards/:cardId` | PATCH | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/cards/sync` | POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/scan` | POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/snmp-walk` | POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/sync-onu` | POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/test-connection` | POST | ✓ (getServerSession) | - | - |
| `/olt/devices/:id/vlan-config` | GET, POST, DELETE | ✓ (getServerSession) | - | - |
| `/olt/onu` | GET | ✓ (getServerSession) | - | - |
| `/olt/onu/:id` | GET, DELETE | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/assign` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/disable` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/enable` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/firmware` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/optical` | GET | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/power-history` | GET | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/reboot` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/register` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/reset` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/:id/traffic` | GET | ✓ (getServerSession) | - | - |
| `/olt/onu/bulk/disable` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/bulk/enable` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/bulk/register` | POST | ✓ (getServerSession) | - | - |
| `/olt/onu/pre-register` | GET, POST | ✓ (getServerSession) | - | - |
| `/olt/onu/search` | GET | ✓ (getServerSession) | - | - |
| `/olt/onu/unregistered` | GET | ✓ (getServerSession) | - | - |
| `/payments` | - | ✗ | - | - |
| `/payments/:id` | - | ✗ | - | - |
| `/pelanggan-ppp` | - | ✗ | - | - |
| `/pelanggan-ppp/:id` | - | ✗ | - | - |
| `/pelanggan-ppp/:id/activate` | POST | ✓ (requireAuth) | - | - |
| `/pelanggan-ppp/:id/cancel-pending-package` | - | ✗ | - | - |
| `/pelanggan-ppp/:id/status` | PATCH | ✗ | - | - |
| `/pelanggan-ppp/:id/suspend` | POST | ✓ (requireAuth) | - | - |
| `/pelanggan-ppp/:id/suspension-history` | GET | ✓ (getServerSession) | - | - |
| `/pelanggan-ppp/:id/usage` | GET | ✓ (getServerSession) | - | - |
| `/pelanggan-ppp/:id/usage/history` | GET | ✓ (getServerSession) | - | - |
| `/pelanggan-ppp/check-id` | GET | ✓ (getServerSession) | - | - |
| `/pelanggan-ppp/generate-id` | GET | ✓ (getServerSession) | - | - |
| `/profileppps` | GET, POST | ✓ (getServerSession) | - | - |
| `/profileppps/:id` | GET, PUT, DELETE | ✓ (requireAuth) | - | - |
| `/registrations` | POST | ✗ | - | - |
| `/roles` | - | ✗ | - | - |
| `/roles/:id` | - | ✗ | - | - |
| `/scheduler/restock-check` | POST | ✗ | - | - |
| `/settings/acs` | - | ✗ | - | - |
| `/settings/acs/test` | - | ✗ | - | - |
| `/settings/acs/vendors` | - | ✗ | - | - |
| `/settings/acs/vendors/:id` | - | ✗ | - | - |
| `/settings/acs/wifi-security` | - | ✗ | - | - |
| `/settings/acs/wifi-security/:id` | - | ✗ | - | - |
| `/settings/api` | - | ✗ | - | - |
| `/settings/api/r2/test` | - | ✗ | - | - |
| `/settings/api/test` | - | ✗ | - | - |
| `/settings/backup/backfill` | - | ✗ | - | - |
| `/settings/backup/export` | - | ✗ | - | - |
| `/settings/backup/import` | - | ✗ | - | - |
| `/settings/backup/reset` | - | ✗ | - | - |
| `/settings/captcha` | - | ✗ | - | - |
| `/settings/general` | - | ✗ | - | - |
| `/settings/general/public` | GET | ✗ | - | - |
| `/settings/logo` | - | ✗ | - | - |
| `/settings/logo/public` | GET | ✗ | - | - |
| `/settings/public` | GET | ✗ | - | - |
| `/settings/radius-defaults` | GET | ✗ | - | - |
| `/settings/ringtone` | - | ✗ | - | - |
| `/sites` | GET | ✗ | - | - |
| `/tagihan/pelanggan/:id` | - | ✗ | - | - |
| `/tenant/feature-flags` | - | ✗ | - | - |
| `/upload` | POST | ✗ | - | - |
| `/uploads` | POST | ✓ (getServerSession) | - | - |
| `/user/fcm-token` | POST | ✓ (getServerSession) | - | - |
| `/user/permissions` | GET | ✓ (getServerSession) | - | - |


### PUBLIC

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/public/captcha-settings` | GET | ✗ | - | - |
| `/public/landing-content` | - | ✗ | - | - |
| `/public/registration-status/:id` | GET | ✗ | - | - |
| `/public/status` | GET | ✗ | - | - |


### WEBHOOKS

| Path | Methods | Auth | Permissions | Services |
|------|---------|------|-------------|----------|
| `/webhooks/:provider` | POST | ✗ | - | - |


---

## 7. Security Summary

### Public Endpoints (No Authentication Required)

- `/:[...route]`
- `/acs/devices`
- `/acs/devices/:id`
- `/acs/devices/:id/tasks`
- `/acs/devices/:id/wan`
- `/admin/accel-ppp-servers`
- `/admin/accel-ppp-servers/:id`
- `/admin/accel-ppp-servers/:id/sessions`
- `/admin/accel-ppp-servers/:id/sessions/:username/kick`
- `/admin/accel-ppp-servers/:id/test-connection`
- `/admin/accounting/coa`
- `/admin/accounting/coa/:id`
- `/admin/accounting/coa/seed`
- `/admin/accounting/journal`
- `/admin/accounting/journal/:id`
- `/admin/accounting/journal/:id/reverse`
- `/admin/accounting/journal/opening-balance`
- `/admin/accounting/period`
- `/admin/accounting/period/:id/close`
- `/admin/accounting/period/:id/reopen`


... and 496 more


### Highly Privileged Endpoints

Endpoints requiring multiple permissions or critical access:



---

## 8. Recommendations

### Authentication Coverage
- 83/599 (14%) endpoints have authentication
- 516 endpoints are public (may need review)

### Critical Endpoints Protection
- 14/98 critical endpoints are authenticated
- 84 critical endpoints are public (⚠️ needs review)

### External Service Integration
- 66 endpoints integrate with external services
- Regular monitoring and error handling review recommended

---

*End of Report*

