# Critical Business Flows - NetManager

> Dokumentasi end-to-end flows untuk critical operations dalam NetManager ISP management system.
> Last updated: 2026-08-09

## Table of Contents

1. [Customer Registration & Activation Flow](#flow-1-customer-registration--activation)
2. [Payment Processing Flow (Webhook)](#flow-2-payment-processing-flow-webhook)
3. [Auto-Isolir Flow (Overdue Billing)](#flow-3-auto-isolir-flow-overdue-billing)
4. [Work Order Lifecycle Flow](#flow-4-work-order-lifecycle-flow)
5. [Invoice Generation Flow (Recurring)](#flow-5-invoice-generation-flow-recurring)
6. [Network Provisioning Flow](#flow-6-network-provisioning-flow)
7. [Attendance Check-in Flow](#flow-7-attendance-check-in-flow)
8. [Cross-Flow Dependencies](#cross-flow-dependencies)
9. [Common Patterns](#common-patterns)

---

## Flow 1: Customer Registration & Activation

### Overview
Flow ini menangani proses pendaftaran pelanggan baru dari website publik, validasi captcha, dan penyimpanan data registrasi yang kemudian akan diproses oleh admin untuk diaktifkan.

### Entry Point
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/registrations/route.ts`
- **Function:** `POST` handler
- **HTTP Endpoint:** `POST /api/registrations`
- **Authentication:** Public (no auth required)

### Authentication & Authorization
- **Public endpoint** - tidak memerlukan authentication
- Captcha verification via Cloudflare Turnstile (jika enabled di settings)

### Input Validation
- **Validation Service:** `RegistrationService.validateCreateInput()`
- **Required Fields:**
  - `name`: string (non-empty)
  - `email`: string (valid email format)
  - `phone`: string (non-empty)
  - `address`: string (non-empty)
- **Optional Fields:**
  - `location`: string
  - `packageName`: string
  - `notes`: string
  - `turnstileToken`: string (Cloudflare Turnstile token)
  - `ipAddress`: string (extracted from headers)

### Flow Diagram

```
Public User → POST /api/registrations
    ↓
1. API Route Handler (route.ts)
    ↓
2. RegistrationService.register()
    ↓
3. Validate Input (required fields, email format)
    ↓
4. Check Duplicate (email/phone with PENDING status)
    ↓
5. Verify Captcha (if enabled via settings)
    ↓
6. Create Registration Record (status: PENDING)
    ↓
7. Return Success Response
```

### Step-by-Step Execution

#### Step 1: API Route Handler
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/registrations/route.ts`
- **Function:** `POST`
- **Action:** 
  - Parse request body
  - Extract IP address from `x-forwarded-for` header
  - Delegate to RegistrationService
- **Database:** None (read-only)
- **Events:** None

#### Step 2: Input Validation
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/registration/services/RegistrationService.ts`
- **Function:** `validateCreateInput()`
- **Action:** 
  - Check required fields (name, email, phone, address)
  - Validate email format with regex
  - Return validation error if any field missing/invalid
- **Database:** None
- **Events:** None

#### Step 3: Duplicate Check
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/registration/services/RegistrationService.ts`
- **Function:** `findPendingDuplicate()`
- **Action:** 
  - Query Registration table for existing PENDING records with same email OR phone
  - Prevent duplicate pending registrations
- **Database:** `Registration` (SELECT)
- **Events:** None

#### Step 4: Captcha Verification
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/registration/services/RegistrationService.ts`
- **Function:** `verifyCaptcha()`
- **Action:**
  - Check if captcha enabled via `settings.captcha_enabled`
  - If enabled, get `settings.captcha_secret_key`
  - Submit verification request to Cloudflare Turnstile API
  - Return error if verification fails
- **Database:** `Settings` (SELECT)
- **Events:** None
- **External API:** `https://challenges.cloudflare.com/turnstile/v0/siteverify`

#### Step 5: Create Registration
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/registration/services/RegistrationService.ts`
- **Function:** `createRegistration()`
- **Action:**
  - Insert new record into Registration table
  - Set status to PENDING (default)
  - Store all submitted data
- **Database:** `Registration` (INSERT)
- **Events:** None

### Database Operations
- **Tables:** 
  - `Registration` (INSERT, SELECT)
  - `Settings` (SELECT for captcha config)
- **Transaction Boundary:** No explicit transaction (single INSERT operation)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
1. **Cloudflare Turnstile Verification** (optional, if captcha enabled)
   - URL: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
   - Method: POST
   - Payload: FormData with `secret`, `response`, `remoteip`
   - Response: `{ success: boolean }`

### Events Emitted
**None** - This flow does not emit domain events. Registration is passive waiting for admin action.

### Side Effects
- New Registration record created with PENDING status
- Appears in admin registration list for manual review

### Success Criteria
- Registration record created successfully
- HTTP 201 response with registration data
- Captcha verified (if enabled)
- No duplicate pending registration exists

### Failure Scenarios

#### 1. Validation Error (HTTP 400)
- **Cause:** Missing required fields or invalid email format
- **Handling:** Return error message immediately
- **Rollback:** No database operation performed
- **User Action:** Fix input and retry

#### 2. Duplicate Registration (HTTP 409)
- **Cause:** Email or phone already exists with PENDING status
- **Handling:** Return conflict error message
- **Rollback:** No database operation performed
- **User Action:** Contact admin or wait for existing registration to be processed

#### 3. Captcha Verification Failed (HTTP 400)
- **Cause:** Invalid captcha token or expired
- **Handling:** Return captcha error message
- **Rollback:** No database operation performed
- **User Action:** Refresh page and retry

#### 4. Captcha Service Unavailable (HTTP 500)
- **Cause:** Network error connecting to Cloudflare
- **Handling:** Return internal error
- **Rollback:** No database operation performed
- **User Action:** Retry later

#### 5. Database Error (HTTP 500)
- **Cause:** Database connection failure or constraint violation
- **Handling:** Log error, return generic error message
- **Rollback:** Automatic (transaction not committed)
- **User Action:** Retry

### Performance Characteristics
- **Expected Duration:** 100-300ms (without captcha), 300-800ms (with captcha verification)
- **Bottlenecks:** 
  - External captcha verification (200-500ms)
  - Duplicate check query (indexed on email/phone, ~10-50ms)
- **Optimization:** 
  - Captcha verification can be made async (accept registration, verify in background)
  - Database index on `(email, phone, status)` for fast duplicate detection

### Testing
- **Test Files:** `/Users/rohadimraja/Documents/radpro/netmanager/tests/modules/registration/` (if exists)
- **Test Coverage:** Unknown (needs verification)
- **How to Test Manually:**
  1. Disable captcha: Set `captcha_enabled = false` in Settings
  2. POST to `/api/registrations` with valid data
  3. Verify registration appears in admin panel with PENDING status
  4. Try duplicate registration - should return 409 error
  5. Enable captcha and test with valid/invalid token

---

## Flow 2: Payment Processing Flow (Webhook)

### Overview
Flow ini menangani webhook dari payment gateway (Xendit, Moota, dll) untuk update status pembayaran, rekonsiliasi invoice, dan trigger aktivasi pelanggan.

### Entry Point
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/webhooks/[provider]/route.ts`
- **Function:** `POST` handler
- **HTTP Endpoint:** `POST /api/webhooks/{provider}` (provider: xendit, moota, tripay, dll)
- **Authentication:** Signature verification (provider-specific)

### Authentication & Authorization
- **Signature Verification:** Provider-specific (Xendit callback token, Moota secret, etc)
- **Service:** `WebhookVerificationService.verifySignature()`
- **Headers:** Provider-specific (e.g., `x-callback-token` for Xendit)

### Input Validation
- **Validation Service:** `WebhookPayloadParser.parse()`
- **Format:** JSON (provider-specific structure)
- **Required Data:** 
  - Transaction ID
  - Order ID (maps to Payment.id or Invoice.invoiceNumber)
  - Amount
  - Status (PAID, PENDING, EXPIRED, etc)
  - Payment method
  - Timestamp

### Flow Diagram

```
Payment Gateway → POST /api/webhooks/{provider}
    ↓
1. Extract & Verify Signature
    ↓
2. Parse Webhook Payload
    ↓
3. Check Idempotency (prevent duplicate processing)
    ↓
4. Record Webhook Event
    ↓
5. Find Payment Record (by orderId or transactionId)
    ↓
6. Validate Amount Match
    ↓
7. [TRANSACTION START]
    ↓
8. Update Payment.gatewayStatus to PAID
    ↓
9. Recompute Invoice Payment State
    ↓
10. If Invoice becomes PAID → Insert INVOICE_PAID event to Outbox
    ↓
11. Mark Webhook Event as PROCESSED
    ↓
12. [TRANSACTION COMMIT]
    ↓
13. Background: EventProcessor dispatches INVOICE_PAID
    ↓
14. Background: InvoicePaidActivationHandler activates customer
    ↓
15. Background: CustomerStatusHandler syncs to MikroTik/RADIUS
```

### Step-by-Step Execution

#### Step 1: Signature Verification
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/WebhookVerificationService.ts`
- **Function:** `verifySignature()`
- **Action:**
  - Extract signature from headers (provider-specific header name)
  - Load secret key from environment or settings
  - Verify signature matches expected value
  - Throw WebhookVerificationError if invalid
- **Database:** None
- **Events:** None
- **Result:** 401 Unauthorized if signature invalid

#### Step 2: Parse Webhook Payload
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/WebhookPayloadParser.ts`
- **Function:** `parse()`
- **Action:**
  - Parse raw JSON body
  - Extract standard fields (orderId, transactionId, amount, status)
  - Normalize provider-specific format to internal WebhookResult
- **Database:** None
- **Events:** None

#### Step 3: Check Idempotency
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/WebhookIdempotencyService.ts`
- **Function:** `checkIdempotency()`
- **Action:**
  - Generate idempotency key: `{provider}:{transactionId}:{orderId}`
  - Query WebhookEvent table for existing record with same key
  - If found and status=PROCESSED → return 200 OK immediately (skip processing)
- **Database:** `WebhookEvent` (SELECT)
- **Events:** None

#### Step 4: Record Webhook Event
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/WebhookIdempotencyService.ts`
- **Function:** `recordWebhookEvent()`
- **Action:**
  - Insert WebhookEvent record with status=PENDING
  - Store idempotency key, provider, payload, signature, rawBody
- **Database:** `WebhookEvent` (INSERT)
- **Events:** None

#### Step 5: Find Payment Record
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/WebhookPaymentLookupService.ts`
- **Function:** `findPaymentByEarlyOrderId()` or `findPaymentAfterWebhook()`
- **Action:**
  - Try early lookup: Query Payment by orderId (Payment.id or Payment.reference)
  - If not found, try after webhook: Query by transactionId or amount (for Moota)
  - For Moota: may record UnmatchedMutation if payment not found
- **Database:** `Payment` (SELECT), optionally `UnmatchedMutation` (INSERT)
- **Events:** None

#### Step 6: Validate Amount
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/webhook-utils.ts`
- **Function:** `hasAmountMismatch()`
- **Action:**
  - Compare Payment.amount with webhook amount
  - Allow small rounding differences (< 1 rupiah)
  - If mismatch detected, mark webhook as FAILED and return 200 OK (logged for manual review)
- **Database:** None
- **Events:** None

#### Step 7-12: Atomic Transaction
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/payment-gateway/services/webhook-processing-service.ts`
- **Function:** `process()` - `prismaBillingAuth.$transaction()`
- **Action:** All following steps happen atomically

##### Step 8: Update Payment Status
- **Database:** `Payment` (UPDATE)
- **Fields Updated:**
  - `gatewayStatus`: PAID
  - `transactionId`: from webhook
  - `gatewayProvider`: provider name
  - `paymentMethod`: normalized from webhook (if available)
  - `paymentDate`: paidAt timestamp from webhook

##### Step 9: Recompute Invoice Payment State
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/InvoicePaymentStateService.ts`
- **Function:** Called via `WebhookInvoiceSettlementService.updateInvoicesOnPaymentTx()`
- **Action:**
  - Extract invoice IDs from Payment.notes or Payment.invoiceId
  - For each invoice:
    - Sum all payments with gatewayStatus=PAID or null
    - If total >= invoice.totalAmount → set status=PAID, paidAt=now
    - If 0 < total < totalAmount → set status=PARTIAL_PAID
    - Update invoice.paidAmount
- **Database:** `Invoice` (UPDATE)
- **Events:** None yet (will emit in next step)

##### Step 10: Emit INVOICE_PAID Event to Outbox
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/lib/event-bus/outbox.ts`
- **Function:** `saveToOutboxTx()`
- **Action:**
  - For each invoice that became PAID (status transitioned from non-PAID to PAID):
    - Insert event to EventOutbox table
    - eventName: "INVOICE_PAID"
    - payload: { invoiceId, pelangganId, amount, paidAt, paymentMethod, tenantId }
    - priority: CRITICAL
    - category: "billing"
    - status: PENDING
- **Database:** `EventOutbox` (INSERT)
- **Events:** INVOICE_PAID (via outbox, processed later)

##### Step 11: Mark Webhook Event as PROCESSED
- **Database:** `WebhookEvent` (UPDATE)
- **Fields:** status=PROCESSED, processedAt=now

##### Step 12: Transaction Commit
- **Action:** If all operations succeed, commit transaction atomically
- **Guarantee:** Payment update + Invoice update + Outbox event insert are all-or-nothing

#### Step 13: Background Event Processing
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/lib/event-bus/processor.ts`
- **Function:** EventProcessor polls EventOutbox table
- **Action:**
  - Pick events with status=PENDING
  - Dispatch to BullMQ queue based on category
  - Update EventOutbox status to PROCESSING
  - After successful job completion, update to COMPLETED

#### Step 14: Invoice Paid Activation Handler
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/pelanggan/services/event-handlers/invoice-paid-activation.handler.ts`
- **Function:** `handleInvoicePaidActivation()`
- **Action:**
  - Receive INVOICE_PAID event from queue
  - Load customer (Pelanggan) by pelangganId
  - Check activation guard:
    - If customer.status already AKTIF → skip
    - If customer.tipe == "REGULER" AND has other unpaid invoices → skip (prevent premature activation)
    - If customer.tipe != "REGULER" (e.g., PRABAYAR) → activate immediately
  - If should activate:
    - Update Pelanggan.status to AKTIF
    - Emit CUSTOMER_ACTIVATED event
- **Database:** `Pelanggan` (SELECT, UPDATE)
- **Events:** CUSTOMER_ACTIVATED

#### Step 15: Network Provisioning (Customer Status Handler)
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/event-handlers/customer-status.handler.ts`
- **Function:** `handleCustomerStatusEvent()`
- **Action:**
  - Receive CUSTOMER_ACTIVATED event
  - Call `RadiusSyncService.handleStatusChange(pelangganId, "AKTIF")`
  - Sync customer to RADIUS database or MikroTik API (depending on connection mode setting)
  - If sync succeeds: Update Pelanggan.syncStatus to SYNCED
  - If sync fails: Update Pelanggan.syncStatus to FAILED, throw error for retry
- **Database:** `Pelanggan` (UPDATE syncStatus), `RadiusUser` (INSERT/UPDATE), or MikroTik API call
- **Events:** None
- **External API:** MikroTik RouterOS API (if connection mode = MIKROTIK_API)

### Database Operations
- **Tables:**
  - `WebhookEvent` (INSERT, UPDATE)
  - `Payment` (SELECT, UPDATE)
  - `Invoice` (SELECT, UPDATE)
  - `EventOutbox` (INSERT)
  - `Pelanggan` (SELECT, UPDATE)
  - `RadiusUser` (INSERT/UPDATE via RADIUS database)
  - `UnmatchedMutation` (INSERT if payment not found for Moota)
- **Transaction Boundary:** 
  - Main transaction: Steps 8-12 (Payment update + Invoice update + Outbox insert + Webhook mark)
  - Event handlers run in separate transactions (can retry independently)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
1. **MikroTik RouterOS API** (if connection mode = MIKROTIK_API)
   - Called from `RadiusSyncService` → `MikroTikPPPSecretService`
   - Operations: Add/update/delete PPP secret, enable/disable user
   - Retry: Handled by event queue (BullMQ)

### Events Emitted
1. **INVOICE_PAID** (via EventOutbox)
   - Payload: `{ invoiceId, pelangganId, amount, paidAt, paymentMethod, tenantId }`
   - Priority: CRITICAL
   - Category: billing
   - Handlers:
     - `invoice-paid-activation.handler.ts` (activates customer if eligible)
     - Potentially accounting/notification handlers

2. **CUSTOMER_ACTIVATED** (from InvoicePaidActivationHandler)
   - Payload: `{ customerId, newStatus, tenantId }`
   - Handlers:
     - `customer-status.handler.ts` (syncs to network infrastructure)

### Side Effects
- Payment gateway status updated to PAID
- Invoice marked as PAID (if fully paid) or PARTIAL_PAID
- Customer status changed to AKTIF (if eligible)
- Network access provisioned (RADIUS/MikroTik)
- Webhook event logged for audit trail
- Metrics recorded for monitoring

### Success Criteria
- Webhook signature verified
- Payment record found and updated
- Invoice payment state recomputed correctly
- INVOICE_PAID event persisted to outbox atomically
- Customer activated if eligible
- Network infrastructure synced successfully
- HTTP 200 OK response returned to payment gateway

### Failure Scenarios

#### 1. Invalid Signature (HTTP 401)
- **Cause:** Wrong secret key or tampered payload
- **Handling:** Return 401 immediately, log warning
- **Rollback:** No database operation performed
- **Retry:** Payment gateway will retry (most gateways retry on non-2xx)
- **Manual Fix:** Check secret key configuration

#### 2. Payment Not Found (HTTP 200)
- **Cause:** orderId/transactionId doesn't match any Payment record
- **Handling:** 
  - For Moota: Record as UnmatchedMutation for manual reconciliation
  - Mark webhook as PROCESSED (no retry needed)
  - Log warning
- **Rollback:** No rollback needed
- **Retry:** No automatic retry (requires manual investigation)
- **Manual Fix:** Check if Payment was created, match manually, or create payment from webhook data

#### 3. Amount Mismatch (HTTP 200)
- **Cause:** Webhook amount differs from Payment.amount
- **Handling:**
  - Mark webhook as FAILED with mismatch details
  - Log warning
  - Return 200 OK (prevent gateway retry)
- **Rollback:** No update performed
- **Retry:** No automatic retry
- **Manual Fix:** Investigate discrepancy, adjust Payment.amount if needed, manually mark as paid

#### 4. Duplicate Webhook (HTTP 200)
- **Cause:** Same transactionId+orderId already processed
- **Handling:** Return 200 OK immediately with "Already processed" message
- **Rollback:** Not applicable (detected before processing)
- **Retry:** No retry needed

#### 5. Database Transaction Failure (HTTP 500)
- **Cause:** Database connection issue, deadlock, constraint violation
- **Handling:**
  - Transaction rollback automatic
  - Return 500 error
  - Payment gateway will retry
- **Rollback:** Automatic (all operations in transaction)
- **Retry:** Yes (gateway retries on 5xx)
- **Manual Fix:** Investigate database issue, fix, wait for gateway retry

#### 6. Event Dispatch Failure (HTTP 500)
- **Cause:** BullMQ connection failure, EventOutbox insert fails
- **Handling:**
  - Transaction rollback (outbox insert is part of transaction)
  - Return 500 error
  - Payment gateway will retry entire flow
- **Rollback:** Automatic
- **Retry:** Yes
- **Manual Fix:** Fix event queue infrastructure

#### 7. Network Sync Failure (Async, not blocking webhook response)
- **Cause:** MikroTik API unavailable, RADIUS database down
- **Handling:**
  - Event handler throws error
  - BullMQ retries with exponential backoff
  - Pelanggan.syncStatus set to FAILED
  - Customer shows as AKTIF in app but network access might not work
- **Rollback:** Only network sync operation
- **Retry:** Yes (BullMQ retry mechanism)
- **Manual Fix:** 
  - Check MikroTik/RADIUS connectivity
  - Manually trigger sync from admin panel
  - Event queue will keep retrying

### Performance Characteristics
- **Expected Duration:** 
  - Webhook processing: 50-200ms (database transaction)
  - End-to-end (including async events): 1-5 seconds
- **Bottlenecks:**
  - Database transaction (50-150ms)
  - Network sync to MikroTik (500ms-2s if connection slow)
  - Event queue dispatch latency (100-500ms)
- **Optimization:**
  - Webhook returns 200 immediately after transaction commit (don't wait for async events)
  - Event processing runs in background with retry
  - Database indexes on Payment.id, Payment.reference, Payment.transactionId

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/payment-gateway/`)
- **Test Coverage:** Unknown
- **How to Test Manually:**
  1. Create Payment record with gatewayStatus=PENDING
  2. Use ngrok or webhook.site to capture webhook payload structure
  3. POST webhook payload to `/api/webhooks/{provider}` with correct signature
  4. Verify Payment.gatewayStatus updated to PAID
  5. Verify Invoice.status updated to PAID
  6. Check EventOutbox for INVOICE_PAID event
  7. Wait for async processing, verify customer status AKTIF
  8. Check RADIUS database or MikroTik for customer credentials
  9. Test duplicate webhook - should return "Already processed"

---

## Flow 3: Auto-Isolir Flow (Overdue Billing)

### Overview
Flow ini menangani proses otomatis untuk mengisolir (memutus internet) pelanggan yang memiliki tagihan terlambat. Berjalan via cron job yang merekonsoliasi billing schedule dan memproses invoice yang overdue.

### Entry Point
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/cron/reconcile-billing-schedules/route.ts`
- **Function:** `GET` or `POST` handler
- **HTTP Endpoint:** `GET/POST /api/cron/reconcile-billing-schedules`
- **Authentication:** Bearer token (CRON_SECRET from environment)
- **Trigger:** Scheduled cron job (daily, typically runs at specific time)

### Authentication & Authorization
- **Bearer Token:** `Authorization: Bearer {CRON_SECRET}`
- **Environment Variable:** `CRON_SECRET`
- **Response:** 401 Unauthorized if token missing or incorrect

### Input Validation
- No request body required
- Authentication via header only

### Flow Diagram

```
Cron Scheduler → GET /api/cron/reconcile-billing-schedules
    ↓
1. Verify CRON_SECRET
    ↓
2. Acquire Distributed Lock (prevent concurrent runs)
    ↓
3. BillingScheduleReconciliationService.reconcile()
    ↓
4. Find Schedules for Reconciliation:
   - Status: PENDING, QUEUED, FAILED
   - OR Status: PROCESSING but stale (>15 min)
   - scheduledFor <= now
    ↓
5. For Each Schedule:
   ↓
6. Reset PROCESSING schedules to PENDING
    ↓
7. Enqueue Schedule to BullMQ
    ↓
8. BullMQ Worker Processes Schedule
    ↓
9. Load Invoice + Customer Data
    ↓
10. Check Invoice Status:
    - If PAID → Cancel schedule, skip
    - If overdue → Process isolation
    ↓
11. Update Customer Status to ISOLIR
    ↓
12. Emit CUSTOMER_ISOLATED event
    ↓
13. CustomerStatusHandler → Sync to MikroTik/RADIUS (disable user)
    ↓
14. Send Notification to Customer
```

### Step-by-Step Execution

#### Step 1: Cron Authentication
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/cron/reconcile-billing-schedules/route.ts`
- **Function:** Handler
- **Action:**
  - Extract Authorization header
  - Compare with `process.env.CRON_SECRET`
  - Return 401 if mismatch
- **Database:** None
- **Events:** None

#### Step 2: Acquire Distributed Lock
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/lib/cron-lock.ts`
- **Function:** `acquireCronLock()`
- **Action:**
  - Use Redis SET NX EX for distributed lock
  - Lock key: `cron:lock:reconcile-billing-schedules`
  - TTL: 55 seconds (prevents overlapping runs)
  - If lock held by another process → return 503 or skip
- **Database:** Redis (SET NX EX)
- **Events:** None

#### Step 3: Find Schedules for Reconciliation
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingScheduleReconciliationService.ts`
- **Function:** `reconcile()`
- **Action:**
  - Query BillingSchedule table:
    - WHERE status IN (PENDING, QUEUED, FAILED)
    - OR (status = PROCESSING AND updatedAt < now - 15 minutes) -- stale processing
    - AND scheduledFor <= now
  - Retrieve all matching schedules
- **Database:** `BillingSchedule` (SELECT)
- **Events:** None

#### Step 4: Prepare Schedules for Retry
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingScheduleReconciliationService.ts`
- **Function:** `prepareScheduleForRetry()`
- **Action:**
  - For schedules with status=PROCESSING (stale):
    - Update status to PENDING (reset for retry)
  - For other statuses (PENDING, QUEUED, FAILED):
    - Leave as-is
- **Database:** `BillingSchedule` (UPDATE)
- **Events:** None

#### Step 5: Enqueue Schedule
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingScheduleService.ts`
- **Function:** `enqueuePersistedSchedule()`
- **Action:**
  - Add job to BullMQ queue: `billing-schedule`
  - Job data: { scheduleId, invoiceId, pelangganId, action }
  - Update schedule status to QUEUED
- **Database:** `BillingSchedule` (UPDATE)
- **Events:** None (queue dispatch)

#### Step 6: BullMQ Worker Processes Schedule
- **File:** Worker processing (inferred from service)
- **Function:** BullMQ job handler
- **Action:**
  - Pick job from queue
  - Update schedule status to PROCESSING
  - Load associated invoice and customer data
- **Database:** `BillingSchedule` (UPDATE), `Invoice` (SELECT), `Pelanggan` (SELECT)
- **Events:** None yet

#### Step 7: Check Invoice Overdue Logic
- **Action:**
  - Load invoice with due date
  - Calculate days overdue: `today - invoice.dueDate`
  - Load grace period setting (e.g., "ISOLIR_GRACE_DAYS" = 3 days)
  - If days overdue > grace period AND invoice.status != PAID:
    - Proceed to isolation
  - If invoice.status == PAID:
    - Cancel schedule, mark as COMPLETED
    - Skip isolation
- **Database:** `Invoice` (SELECT), `Settings` (SELECT for grace period)
- **Events:** None

#### Step 8: Update Customer Status to ISOLIR
- **File:** Inferred from PelangganService
- **Function:** `updateStatusPelanggan(pelangganId, "ISOLIR")`
- **Action:**
  - Update Pelanggan.status to ISOLIR
  - Update Pelanggan.catatan (notes) with isolation reason
  - Set Pelanggan.updatedAt
- **Database:** `Pelanggan` (UPDATE)
- **Events:** CUSTOMER_ISOLATED (emitted after status update)

#### Step 9: Emit CUSTOMER_ISOLATED Event
- **File:** Event dispatcher (inferred)
- **Function:** EventBus dispatch
- **Action:**
  - Insert event to EventOutbox or dispatch directly to BullMQ
  - Event name: "CUSTOMER_ISOLATED"
  - Payload: { customerId, oldStatus, newStatus: "ISOLIR", tenantId }
- **Database:** `EventOutbox` (INSERT)
- **Events:** CUSTOMER_ISOLATED

#### Step 10: Network Sync (Disable User)
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/event-handlers/customer-status.handler.ts`
- **Function:** `handleCustomerStatusEvent()`
- **Action:**
  - Receive CUSTOMER_ISOLATED event
  - Call `RadiusSyncService.handleStatusChange(pelangganId, "ISOLIR")`
  - Disable user in RADIUS or MikroTik:
    - RADIUS mode: Delete RadiusUser record (prevents authentication)
    - MikroTik API mode: Disable PPP secret or set profile to blocked
  - Terminate active sessions (disconnect current connections)
  - Update Pelanggan.syncStatus to SYNCED or FAILED
- **Database:** `RadiusUser` (DELETE or UPDATE), `Pelanggan` (UPDATE syncStatus)
- **Events:** None
- **External API:** MikroTik RouterOS API (if MIKROTIK_API mode)

#### Step 11: Send Notification
- **File:** Notification handlers (if wired)
- **Action:**
  - Send push notification to customer app
  - Send WhatsApp/SMS notification (if integration enabled)
  - Send email notification
  - Content: "Layanan internet Anda telah dinonaktifkan karena tagihan belum dibayar. Silakan lakukan pembayaran."
- **Database:** `Notification` (INSERT), FCM tokens (SELECT)
- **Events:** None

#### Step 12: Update Schedule Status
- **Action:**
  - Mark BillingSchedule status as COMPLETED
  - Set completedAt timestamp
- **Database:** `BillingSchedule` (UPDATE)
- **Events:** None

### Database Operations
- **Tables:**
  - `BillingSchedule` (SELECT, UPDATE)
  - `Invoice` (SELECT)
  - `Pelanggan` (SELECT, UPDATE)
  - `Settings` (SELECT for grace period)
  - `EventOutbox` (INSERT)
  - `RadiusUser` (DELETE or UPDATE)
  - `Notification` (INSERT)
- **Transaction Boundary:**
  - Schedule reconciliation: No explicit transaction (idempotent updates)
  - Status update + event emit: Single transaction
  - Network sync: Separate transaction (can retry independently)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
1. **MikroTik RouterOS API** (if MIKROTIK_API mode)
   - Operation: Disable PPP secret or update profile
   - Called from: `MikroTikPPPSecretService.handleStatusChange()`
   - Retry: Via event queue (BullMQ)

2. **Notification Services** (optional)
   - WhatsApp/SMS gateway
   - Firebase Cloud Messaging (push notifications)
   - Email service

### Events Emitted
1. **CUSTOMER_ISOLATED**
   - Payload: `{ customerId, oldStatus, newStatus: "ISOLIR", reason: "overdue", tenantId }`
   - Handlers:
     - `customer-status.handler.ts` (network sync)
     - Notification handlers

### Side Effects
- Customer internet access disabled
- Customer status changed to ISOLIR
- Active PPPoE sessions terminated
- RADIUS/MikroTik credentials removed or disabled
- Billing schedule marked as completed
- Notifications sent to customer

### Success Criteria
- All overdue schedules processed
- Customers with unpaid overdue invoices marked as ISOLIR
- Network access successfully disabled
- Cron lock released after completion
- All schedules moved from PENDING/FAILED to COMPLETED or re-queued

### Failure Scenarios

#### 1. Lock Already Held (HTTP 200 or 503)
- **Cause:** Another cron instance already running
- **Handling:** Return "already running" response, skip execution
- **Rollback:** Not applicable
- **Retry:** Next scheduled cron run (typically next day)

#### 2. Schedule Processing Timeout (Stale PROCESSING)
- **Cause:** Worker crashed or hung during schedule processing
- **Handling:** 
  - Detected by reconciliation (status=PROCESSING for >15 minutes)
  - Reset to PENDING
  - Re-enqueue for retry
- **Rollback:** Status reset to PENDING
- **Retry:** Immediate (re-enqueued)

#### 3. Network Sync Failure
- **Cause:** MikroTik API unreachable, RADIUS database down
- **Handling:**
  - Event handler throws error
  - BullMQ retries with exponential backoff
  - Pelanggan.syncStatus set to FAILED
  - Customer shows as ISOLIR in app but might still have network access (inconsistent state)
- **Rollback:** Only network sync operation fails
- **Retry:** Yes (BullMQ retry, up to configured max attempts)
- **Manual Fix:**
  - Check network infrastructure
  - Manually sync from admin panel
  - Alert admin about sync failure

#### 4. Database Connection Failure
- **Cause:** Database unavailable during schedule query or update
- **Handling:**
  - Cron job fails with error
  - Lock released (or expires after TTL)
  - No schedules processed
- **Rollback:** Automatic (no partial state)
- **Retry:** Next cron run
- **Manual Fix:** Investigate database issue

#### 5. Invoice Already Paid (Race Condition)
- **Cause:** Invoice paid between schedule creation and execution
- **Handling:**
  - Check invoice.status before isolation
  - If PAID, cancel schedule and skip isolation
  - Mark schedule as CANCELLED or COMPLETED
- **Rollback:** Not needed (skip operation)
- **Retry:** No retry needed

### Performance Characteristics
- **Expected Duration:** 
  - Reconciliation query: 100-500ms (depends on schedule count)
  - Per-schedule processing: 200-1000ms
  - Total: 1-10 minutes for hundreds of schedules
- **Bottlenecks:**
  - Database query for schedules (indexed on status, scheduledFor)
  - Network sync operations (MikroTik API can be slow)
  - BullMQ queue throughput (limited by concurrency setting)
- **Optimization:**
  - Process schedules in parallel (BullMQ concurrency)
  - Batch network sync operations if API supports
  - Index BillingSchedule table on (status, scheduledFor)

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/finance/`)
- **Test Coverage:** Unknown
- **How to Test Manually:**
  1. Create invoice with past due date (e.g., 5 days ago)
  2. Ensure invoice status is UNPAID or SENT
  3. Create or wait for BillingSchedule with action=ISOLATE_OVERDUE
  4. Trigger cron: `curl -H "Authorization: Bearer {CRON_SECRET}" http://localhost:3000/api/cron/reconcile-billing-schedules`
  5. Verify schedule status changes: PENDING → QUEUED → PROCESSING → COMPLETED
  6. Verify Pelanggan.status changed to ISOLIR
  7. Check RADIUS database or MikroTik for disabled user
  8. Try to connect via PPPoE - should be rejected
  9. Pay invoice and verify customer re-activated

---

## Flow 4: Work Order Lifecycle Flow

### Overview
Flow ini menangani lifecycle work order dari request (pengajuan) oleh karyawan via mobile app, approval oleh admin, assignment ke teknisi, eksekusi di lapangan, sampai completion dan inventory update.

### Entry Point
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/MobileWorkOrderRequestService.ts`
- **Function:** `createRequest()`
- **HTTP Endpoint:** POST (inferred from service, likely `/api/mobile/work-orders/request` or similar)
- **Authentication:** Required (session user)

### Authentication & Authorization
- **Session Required:** Yes (user.id extracted from session)
- **Permissions:** Typically `workorders:create` or public access for employees
- **Tenant Isolation:** tenantId from user session

### Input Validation
- **Required Fields:**
  - `type`: INSTALLATION | MAINTENANCE | TROUBLESHOOT | UPGRADE | DISCONNECTION | RELOCATION
  - `title`: string
  - `description`: string
- **Optional Fields:**
  - `priority`: URGENT | HIGH | NORMAL | LOW (default: NORMAL)
  - `departmentId`: string
  - `siteId`: string
  - `contactName`: string
  - `contactPhone`: string
  - `locationAddress`: string
  - `latitude`: number
  - `longitude`: number
  - `notes`: string

### Flow Diagram

```
Employee (Mobile) → POST /api/mobile/work-orders/request
    ↓
1. Create Work Order (status: REQUESTED)
    ↓
2. Auto-route to Department (based on type)
    ↓
3. Broadcast via Socket.IO (real-time notification)
    ↓
4. Notify Admins (in-app + push notification)
    ↓
[Admin Panel]
    ↓
5. Admin Reviews Request
    ↓
6. Admin Approves → Status: OPEN
    ↓
7. Admin Assigns to Technician
    ↓
[Technician Mobile App]
    ↓
8. Technician Accepts → Status: IN_PROGRESS
    ↓
9. Technician Travels to Location
    ↓
10. Technician Completes Work
    ↓
11. Upload Photos (before/after)
    ↓
12. Record Materials Used (inventory deduction)
    ↓
13. Submit Completion
    ↓
14. Status: COMPLETED
    ↓
15. Admin Verifies Completion
    ↓
16. Inventory Updated (materials deducted)
    ↓
17. Customer Notified (if customer-facing WO)
```

### Step-by-Step Execution

#### Step 1: Create Work Order Request
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/MobileWorkOrderRequestService.ts`
- **Function:** `createRequest()`
- **Action:**
  - Extract user details from session (userId, userName, tenantId, siteId)
  - Resolve departmentId:
    - If provided in body → use it
    - Else auto-route based on type (INSTALLATION/DISCONNECTION → Technical dept)
    - Else use user.departmentId
    - Else use first department in tenant
  - Generate work order number (auto-increment or UUID-based)
  - Create WorkOrder record with status=REQUESTED
  - Set requestedById = userId
- **Database:** `WorkOrder` (INSERT), `Departments` (SELECT), `User` (SELECT)
- **Events:** None (real-time broadcast instead)

#### Step 2: Auto-Route to Department
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/MobileWorkOrderRequestService.ts`
- **Function:** `getDepartmentByWorkOrderType()`
- **Action:**
  - Map work order type to department:
    - INSTALLATION, DISCONNECTION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION → "Technical"
  - Query Departments table for department with name="Technical" in tenant
  - Set WorkOrder.departmentId
- **Database:** `Departments` (SELECT)
- **Events:** None

#### Step 3: Broadcast Real-time Notification
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/MobileWorkOrderRequestService.ts`
- **Function:** `broadcastNewWorkOrder()`
- **Action:**
  - Import Socket.IO emitter
  - Emit event: `newWorkOrder`
  - Payload: { id, workOrderNumber, title, type, status, priority, departmentId, assignedToId, createdAt }
  - Target: Admin dashboard (filtered by departmentId and siteId)
- **Database:** None
- **Events:** Socket.IO event (real-time)

#### Step 4: Notify Admins
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/MobileWorkOrderRequestService.ts`
- **Function:** `notifyAdmins()`
- **Action:**
  - Query User table for admins with permission: `workorders:approve_request` or `workorders:read`
  - Filter by: isActive=true, tenantId match
  - For each admin:
    - Create in-app notification: "📝 WO Request Baru: {userName} mengajukan: {title}"
    - Link: `/admin/workorders/list?status=REQUESTED`
    - sourceType: WORK_ORDER, sourceId: workOrderId
  - Send FCM push notification to all admin devices
  - Notification data: { workOrderId, type: "WO_REQUEST", screen: "WorkOrderRequests" }
- **Database:** `User` (SELECT with role/permission join), `Notification` (INSERT), FCM tokens (SELECT)
- **Events:** None
- **External API:** Firebase Cloud Messaging (push notifications)

#### Step 5-6: Admin Approval
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/work-order/services/AdminWorkOrderActionRouteService.ts`
- **Function:** Approve action handler
- **Action:**
  - Admin reviews work order in admin panel
  - Admin clicks "Approve" button
  - API call: PATCH `/api/admin/workorders/{id}/approve`
  - Update WorkOrder.status to OPEN
  - Set approvedBy, approvedAt
  - Optionally set priority, department, or other fields
- **Database:** `WorkOrder` (UPDATE)
- **Events:** Potentially WORK_ORDER_APPROVED event

#### Step 7: Admin Assigns to Technician
- **Action:**
  - Admin selects technician from dropdown (filtered by department/site)
  - API call: PATCH `/api/admin/workorders/{id}/assign`
  - Update WorkOrder.assignedToId
  - Send notification to technician
- **Database:** `WorkOrder` (UPDATE), `Notification` (INSERT)
- **Events:** Potentially WORK_ORDER_ASSIGNED event

#### Step 8: Technician Accepts
- **Action:**
  - Technician sees work order in mobile app
  - Clicks "Accept" or "Start Work"
  - API call: PATCH `/api/mobile/workorders/{id}/accept` or `/start`
  - Update WorkOrder.status to IN_PROGRESS
  - Set startedAt timestamp
- **Database:** `WorkOrder` (UPDATE)
- **Events:** None

#### Step 9-11: Technician Completes Work
- **Action:**
  - Technician performs work at location
  - Uploads photos:
    - Before photos (issue documentation)
    - After photos (completion proof)
  - Records materials used:
    - Select items from inventory
    - Specify quantity per item
  - Fills completion notes
- **Database:** `WorkOrderPhoto` (INSERT), `WorkOrderMaterial` (INSERT - temporary, pending verification)
- **Events:** None

#### Step 12: Submit Completion
- **File:** Mobile work order completion service (inferred)
- **Action:**
  - API call: POST `/api/mobile/workorders/{id}/complete`
  - Update WorkOrder.status to COMPLETED
  - Set completedAt timestamp
  - Store completion notes
  - Photos and materials already uploaded in previous step
- **Database:** `WorkOrder` (UPDATE)
- **Events:** WORK_ORDER_COMPLETED

#### Step 13: Admin Verification
- **Action:**
  - Admin reviews completion (photos, notes, materials)
  - Admin can:
    - Accept: Verify completion, finalize inventory deduction
    - Reject: Request rework, change status back to IN_PROGRESS
    - Adjust materials: Modify quantities before inventory deduction
- **Database:** `WorkOrder` (UPDATE if rejected)
- **Events:** None

#### Step 14: Inventory Update
- **Action:**
  - When admin verifies completion:
  - For each material in WorkOrderMaterial:
    - Deduct quantity from Inventory
    - Create InventoryTransaction record (type: WORK_ORDER_USAGE)
    - Link transaction to work order
  - Update Inventory.currentStock
  - Mark WorkOrder as VERIFIED or CLOSED
- **Database:** `Inventory` (UPDATE), `InventoryTransaction` (INSERT), `WorkOrderMaterial` (UPDATE verified=true)
- **Events:** Potentially INVENTORY_UPDATED event

#### Step 15: Customer Notification (if applicable)
- **Action:**
  - If work order is customer-facing (type=INSTALLATION, DISCONNECTION, etc) and has pelangganId:
    - Send notification to customer
    - Content: "Pekerjaan {type} untuk layanan Anda telah selesai."
  - Update customer status if needed (e.g., INSTALLATION completed → activate customer)
- **Database:** `Notification` (INSERT)
- **Events:** Potentially trigger customer activation flow

### Database Operations
- **Tables:**
  - `WorkOrder` (INSERT, UPDATE, SELECT)
  - `Departments` (SELECT)
  - `User` (SELECT for department/assignment/notification)
  - `Notification` (INSERT multiple times)
  - `WorkOrderPhoto` (INSERT)
  - `WorkOrderMaterial` (INSERT, UPDATE)
  - `Inventory` (SELECT, UPDATE)
  - `InventoryTransaction` (INSERT)
  - FCM tokens table (SELECT for push notifications)
- **Transaction Boundary:**
  - Work order creation: Single INSERT (no transaction needed)
  - Inventory deduction: Transaction required (Inventory UPDATE + InventoryTransaction INSERT atomic)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
1. **Firebase Cloud Messaging (FCM)**
   - Push notifications to admin and technician devices
   - Called from: `sendPushToUsers()`
   - Retry: Best-effort (no retry)

2. **Socket.IO**
   - Real-time broadcast to admin dashboard
   - Called from: `socketEmitter.newWorkOrder()`
   - No retry (real-time only)

### Events Emitted
1. **WORK_ORDER_CREATED** (inferred, may not be implemented)
2. **WORK_ORDER_APPROVED** (inferred)
3. **WORK_ORDER_ASSIGNED** (inferred)
4. **WORK_ORDER_COMPLETED**
5. **INVENTORY_UPDATED** (inferred)

### Side Effects
- Work order created in system
- Admins notified in real-time
- Technician assigned and notified
- Inventory stock reduced when work completed
- Inventory transaction log created
- Customer notified (if applicable)
- Photos stored for audit trail

### Success Criteria
- Work order successfully created with REQUESTED status
- Admins receive notifications
- Work order progresses through statuses: REQUESTED → OPEN → IN_PROGRESS → COMPLETED → VERIFIED
- Inventory accurately updated
- All photos uploaded and stored
- Materials usage tracked

### Failure Scenarios

#### 1. Department Not Found
- **Cause:** No Technical department exists in tenant
- **Handling:** Fall back to first available department or user's department
- **Rollback:** Not needed (default resolution)
- **Manual Fix:** Create Technical department

#### 2. Admin Notification Failure
- **Cause:** No admins found with appropriate permissions
- **Handling:** 
  - Work order still created successfully
  - Log warning
  - Admins need to check manually
- **Rollback:** Not needed
- **Manual Fix:** Assign workorders permission to at least one admin role

#### 3. Socket.IO Broadcast Failure
- **Cause:** Socket.IO server not running or connection issue
- **Handling:**
  - Work order still created
  - Log error
  - Admins rely on push notification or manual refresh
- **Rollback:** Not needed
- **Retry:** No retry (real-time only)

#### 4. FCM Push Notification Failure
- **Cause:** FCM service unavailable or invalid tokens
- **Handling:**
  - Work order still created
  - In-app notification still created (users see it when they open app)
  - Log error
- **Rollback:** Not needed
- **Retry:** No retry

#### 5. Inventory Insufficient Stock
- **Cause:** Material quantity requested exceeds available stock
- **Handling:**
  - Admin sees warning during verification
  - Can choose to:
    - Adjust quantity
    - Proceed anyway (allow negative stock)
    - Reject completion and request re-submission
- **Rollback:** Not needed (verified before deduction)
- **Manual Fix:** Restock inventory or adjust material usage

#### 6. Photo Upload Failure
- **Cause:** Network issue, storage quota exceeded
- **Handling:**
  - Technician sees upload error
  - Can retry upload
  - Can save work order as draft (if implemented)
  - Can submit without photos (if policy allows)
- **Rollback:** Photo records not created
- **Retry:** Manual retry by technician

### Performance Characteristics
- **Expected Duration:** 
  - Create request: 100-300ms
  - Notify admins: 200-500ms (parallel notifications)
  - Photo upload: 1-5 seconds per photo (depends on size/network)
  - Inventory update: 50-200ms (transaction)
- **Bottlenecks:**
  - Photo upload (network-dependent)
  - Push notification delivery (FCM API latency)
  - Admin query with permission join (needs index)
- **Optimization:**
  - Upload photos in parallel
  - Cache department lookup
  - Index User table on (isActive, tenantId, role)
  - Batch push notifications

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/work-order/`)
- **Test Coverage:** Unknown
- **How to Test End-to-End:**
  1. Login as employee via mobile app
  2. Create work order request with type=INSTALLATION
  3. Verify admin receives notification
  4. Login as admin, approve work order
  5. Assign to technician
  6. Login as technician, accept work order
  7. Upload before photos
  8. Record materials used (select from inventory)
  9. Upload after photos
  10. Submit completion
  11. Login as admin, verify materials and photos
  12. Accept completion
  13. Check inventory stock reduced
  14. Check InventoryTransaction created

---

## Flow 5: Invoice Generation Flow (Recurring)

### Overview
Flow ini menangani proses otomatis untuk generate invoice bulanan untuk pelanggan aktif. Berjalan via cron job harian yang memeriksa pelanggan dengan billing cycle date yang match, menghitung charges (termasuk proration jika ada), dan membuat invoice baru.

### Entry Point
- **File:** Cron job calls `AutomaticBillingService.generateDailyInvoices()`
- **Service:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/AutomaticBillingService.ts`
- **Function:** `generateDailyInvoices()`
- **HTTP Endpoint:** Triggered via cron (no direct HTTP endpoint, or via `/api/cron/generate-invoices` if exists)
- **Authentication:** CRON_SECRET if via HTTP

### Authentication & Authorization
- **Cron Job:** Runs via internal scheduler or cron HTTP endpoint
- **Authentication:** CRON_SECRET bearer token if HTTP-triggered

### Input Validation
- No request input (scheduled job)
- Configuration from Settings table:
  - `GENERAL_INVOICE_OTOMATIS`: Days before due date to generate invoice (billing window)

### Flow Diagram

```
Cron Scheduler → AutomaticBillingService.generateDailyInvoices()
    ↓
1. Load Billing Window Setting (days before due date)
    ↓
2. Calculate Target Billing Date (today + billing window days)
    ↓
3. Find Eligible Customers (batch processing)
    ↓
4. For Each Batch (e.g., 100 customers at a time):
    ↓
5. Load Customers with Billing Cycle = Target Date
    ↓
6. Filter: Status = AKTIF, Has Active Package
    ↓
7. Check if Invoice Already Exists for Due Date
    ↓
8. For Each Eligible Customer:
    ↓
9. Calculate Invoice Amount:
   - Base: Package price (hargaPaket.harga)
   - PPN: If usePPN enabled (hargaPaket.ppnPercentage)
   - Proration: If package changed mid-cycle
   - Discounts: Apply coupons if any
    ↓
10. Create Invoice Record
    ↓
11. Set Invoice Due Date = Customer.jatuhTempo
    ↓
12. Create Billing Schedule (for reminders/isolation)
    ↓
13. Trigger Garbage Collection (memory optimization)
    ↓
14. Process Next Batch
    ↓
15. Send Daily Payment Reminders (separate job)
```

### Step-by-Step Execution

#### Step 1: Load Billing Window
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/AutomaticBillingService.ts`
- **Function:** `getDaysBeforeDue()`
- **Action:**
  - Query Settings table for key='GENERAL_INVOICE_OTOMATIS'
  - Parse value as integer (e.g., "7" means generate 7 days before due)
  - Default to 7 if not set
- **Database:** `Settings` (SELECT)
- **Events:** None

#### Step 2: Calculate Target Billing Date
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/automatic-billing.helpers.ts`
- **Function:** `createTargetBillingDate()`
- **Action:**
  - Calculate: today + daysBeforeDue
  - Extract day-of-month from result
  - Example: Today = Aug 2, daysBeforeDue = 7 → Target = Aug 9 → Day = 9
  - Find customers with jatuhTempo (billing cycle day) = 9
- **Database:** None
- **Events:** None

#### Step 3: Batch Processing Setup
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/automatic-billing.helpers.ts`
- **Function:** `getBillingBatchSize()`
- **Action:**
  - Get batch size from environment or default (e.g., 100 customers per batch)
  - Initialize offset = 0 for pagination
- **Database:** None
- **Events:** None

#### Step 4: Find Eligible Customers
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/AutomaticBillingService.ts`
- **Function:** Via `getPelangganBridge().findEligibleForBilling()`
- **Action:**
  - Query Pelanggan table:
    - WHERE DAY(jatuhTempo) = targetDate.getDate()
    - AND status = 'AKTIF'
    - AND hargaPaketId IS NOT NULL (has active package)
  - Include related data: HargaPaket (price, PPN settings)
  - LIMIT batchSize OFFSET currentOffset
  - Return array of customer objects
- **Database:** `Pelanggan` (SELECT with join to `HargaPaket`)
- **Events:** None

#### Step 5: Check Existing Invoices
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/AutomaticBillingService.ts`
- **Function:** `getExistingInvoiceCustomerSet()`
- **Action:**
  - Build due date range: (targetDate - 1 day, targetDate + 1 day)
  - Query Invoice table:
    - WHERE pelangganId IN (batch customer IDs)
    - AND dueDate BETWEEN range.start AND range.end
  - Create Set of pelangganIds that already have invoice
  - Skip invoice creation for customers in this set
- **Database:** `Invoice` (SELECT with IN clause)
- **Events:** None

#### Step 6: Calculate Invoice Amount
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingInvoiceCreationService.ts`
- **Function:** `createInvoiceForCustomer()`
- **Action:**
  - Base amount: hargaPaket.harga
  - If usePPN enabled:
    - PPN amount = base × (ppnPercentage / 100)
    - Total with PPN = base + PPN
  - Check for proration:
    - If package changed mid-cycle (check proration log)
    - Calculate prorated amount based on days used
  - Check for coupons:
    - Query active coupons for customer
    - Apply discount (percentage or fixed amount)
  - Final total = base + PPN - discount + proration adjustments
- **Database:** `ProrateLog` (SELECT), `Coupon` (SELECT)
- **Events:** None

#### Step 7: Create Invoice
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingInvoiceCreationService.ts`
- **Function:** `createInvoiceForCustomer()`
- **Action:**
  - Generate invoice number (format: INV-YYYYMM-{sequence})
  - Create Invoice record:
    - pelangganId
    - invoiceNumber
    - issueDate = today
    - dueDate = customer.jatuhTempo (calculated as next occurrence of billing cycle day)
    - totalAmount = calculated amount
    - paidAmount = 0
    - status = SENT
    - description = "Tagihan Internet {packageName} - {month}"
  - Create InvoiceLineItem records (breakdown: subscription, PPN, discounts)
- **Database:** `Invoice` (INSERT), `InvoiceLineItem` (INSERT)
- **Events:** None (invoice creation is passive, events triggered on payment)

#### Step 8: Create Billing Schedule
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/billingScheduleLifecycle.ts`
- **Function:** `syncInvoiceBillingSchedules()`
- **Action:**
  - Create BillingSchedule records for:
    - Payment reminders (e.g., 3 days before due, 1 day before due, on due date)
    - Isolation (e.g., 3 days after due if unpaid)
  - Each schedule has:
    - invoiceId
    - scheduledFor = calculated date
    - action = SEND_REMINDER or ISOLATE_OVERDUE
    - status = PENDING
- **Database:** `BillingSchedule` (INSERT multiple)
- **Events:** None

#### Step 9: Memory Optimization
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/AutomaticBillingService.ts`
- **Function:** `triggerGarbageCollection()`
- **Action:**
  - Call `global.gc()` if available (Node.js started with --expose-gc)
  - Helps manage memory for large batch processing
- **Database:** None
- **Events:** None

#### Step 10: Next Batch
- **Action:**
  - Increment offset by batchSize
  - Repeat from Step 4 until no more customers returned
- **Database:** Multiple SELECT queries
- **Events:** None

#### Step 11: Send Payment Reminders (Separate Job)
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/finance/services/BillingReminderService.ts`
- **Function:** `sendDailyReminders()`
- **Action:**
  - Runs as separate cron job (typically every minute or hour)
  - Check current time matches reminderTime setting
  - Find invoices with reminder scheduled for today
  - Send notifications to customers (in-app, WhatsApp, email)
- **Database:** `Invoice` (SELECT), `BillingSchedule` (SELECT), `Notification` (INSERT)
- **Events:** None

### Database Operations
- **Tables:**
  - `Settings` (SELECT)
  - `Pelanggan` (SELECT batched)
  - `HargaPaket` (SELECT via JOIN)
  - `Invoice` (SELECT for duplicates, INSERT new)
  - `InvoiceLineItem` (INSERT)
  - `BillingSchedule` (INSERT)
  - `ProrateLog` (SELECT for proration calculation)
  - `Coupon` (SELECT for discounts)
- **Transaction Boundary:**
  - Each invoice creation is independent (can use transaction per invoice)
  - If one invoice fails, others continue processing
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
None directly in invoice generation. Payment reminders may call:
1. **WhatsApp/SMS Gateway** (for payment reminders)
2. **Email Service** (for invoice email)
3. **Firebase Cloud Messaging** (for push notifications)

### Events Emitted
**None during generation.** Events emitted later when:
- Invoice paid → INVOICE_PAID
- Invoice overdue → CUSTOMER_ISOLATED (via billing schedule)

### Side Effects
- Invoices created for all active customers
- Billing schedules created for reminders and isolation
- Customers can see new invoices in app/portal
- Automatic payment reminders scheduled

### Success Criteria
- All eligible customers have invoices generated
- No duplicate invoices for same due date
- Amounts calculated correctly (including PPN, proration, discounts)
- Billing schedules created for all invoices
- Process completes within reasonable time (e.g., <10 minutes for 10,000 customers)

### Failure Scenarios

#### 1. Settings Not Found
- **Cause:** GENERAL_INVOICE_OTOMATIS setting missing
- **Handling:** Use default value (7 days)
- **Rollback:** Not needed
- **Manual Fix:** Add setting to Settings table

#### 2. Customer Package Not Found
- **Cause:** Pelanggan.hargaPaketId references deleted HargaPaket
- **Handling:**
  - Skip customer with warning log
  - Continue processing other customers
- **Rollback:** Not needed
- **Manual Fix:** Assign valid package to customer

#### 3. Duplicate Invoice
- **Cause:** Race condition (multiple cron runs) or manual invoice creation
- **Handling:**
  - Check for existing invoice before creation
  - Skip if invoice already exists for due date
  - Log info message
- **Rollback:** Not needed
- **Retry:** No retry needed (idempotent)

#### 4. Database Connection Failure During Batch
- **Cause:** Database unavailable mid-processing
- **Handling:**
  - Current batch fails
  - Already-created invoices remain (partial success)
  - Next cron run will process remaining customers (idempotent check prevents duplicates)
- **Rollback:** Partial (completed invoices remain)
- **Retry:** Next cron run (typically next day)

#### 5. Proration Calculation Error
- **Cause:** Invalid proration log data or calculation bug
- **Handling:**
  - Log error with customer details
  - Fall back to standard package price (no proration)
  - Create invoice with warning flag
  - Alert admin for manual review
- **Rollback:** Not needed
- **Manual Fix:** Review and adjust invoice amount manually

#### 6. PPN Calculation Overflow
- **Cause:** Extremely large package price causing numeric overflow
- **Handling:**
  - Catch error, log customer ID
  - Skip customer
  - Alert admin
- **Rollback:** Not needed
- **Retry:** Manual intervention required

### Performance Characteristics
- **Expected Duration:**
  - Per customer: 50-200ms (including invoice + line items + schedules)
  - Batch of 100: 5-20 seconds
  - 10,000 customers: 5-20 minutes total
- **Bottlenecks:**
  - Database queries (customer lookup, invoice insert)
  - Proration calculation (if many package changes)
  - Batch size too large → memory issues
  - Batch size too small → too many queries
- **Optimization:**
  - Batch processing with pagination (current: 100 per batch)
  - Preload all customers with JOIN to HargaPaket
  - Bulk insert InvoiceLineItem (batch INSERT)
  - Index on Pelanggan(jatuhTempo, status)
  - Index on Invoice(pelangganId, dueDate) for duplicate check
  - Trigger garbage collection between batches

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/finance/`)
- **Test Coverage:** Unknown
- **How to Test:**
  1. Set GENERAL_INVOICE_OTOMATIS = 0 (generate on same day)
  2. Create test customer with jatuhTempo = today's day-of-month
  3. Ensure customer status = AKTIF, has hargaPaketId
  4. Run: `AutomaticBillingService.generateDailyInvoices()`
  5. Verify Invoice created with correct amount
  6. Verify InvoiceLineItem breakdown correct
  7. Verify BillingSchedule created
  8. Run again - should skip (duplicate check)
  9. Test proration: Change customer package mid-cycle, verify prorated invoice
  10. Test PPN: Enable usePPN, verify PPN line item added

---

## Flow 6: Network Provisioning Flow

### Overview
Flow ini menangani provisioning network access untuk pelanggan setelah status change (activation, suspension, isolation). Mensinkronkan credentials dan konfigurasi ke RADIUS database atau MikroTik API untuk mengontrol akses internet.

### Entry Point
- **Event Handler:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/event-handlers/customer-status.handler.ts`
- **Function:** `handleCustomerStatusEvent()`
- **Trigger:** Domain events (CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_ACTIVATED, CUSTOMER_SUSPENDED, CUSTOMER_ISOLATED, CUSTOMER_DELETED)
- **Queue:** BullMQ event queue

### Authentication & Authorization
- **Internal Event Handler:** No HTTP authentication
- **Event Queue:** Authenticated via BullMQ connection

### Input Validation
- **Event Payload:**
  - `customerId`: string (required)
  - `username`: string (required for DELETE event)
  - `newStatus`: Status enum (for status change events)
  - `tenantId`: string (required)

### Flow Diagram

```
Domain Event Emitted → Event Queue (BullMQ) → CustomerStatusHandler
    ↓
1. Receive Event (CUSTOMER_ACTIVATED, etc)
    ↓
2. Load Connection Mode Setting (RADIUS vs MIKROTIK_API)
    ↓
3. RadiusSyncService.handleStatusChange()
    ↓
[If RADIUS Mode]
    ↓
4a. Load Customer Data (username, password, bandwidth profile)
    ↓
5a. UPSERT RadiusUser (radcheck + radreply tables)
    ↓
6a. Set RadiusUser attributes:
   - Cleartext-Password = customer.password
   - Mikrotik-Rate-Limit = bandwidth profile
    ↓
7a. If Status = ISOLIR/NONAKTIF → DELETE RadiusUser
    ↓
[If MIKROTIK_API Mode]
    ↓
4b. Load Customer + Router Assignment
    ↓
5b. Connect to MikroTik RouterOS API
    ↓
6b. Find PPP Secret by username
    ↓
7b. If Status = AKTIF:
   - Add/Update PPP Secret
   - Set profile = customer bandwidth profile
   - Set password
   - Enable secret
    ↓
8b. If Status = ISOLIR/NONAKTIF:
   - Disable PPP Secret
   - OR Change profile to "blocked"
   - Terminate active sessions
    ↓
[Both Modes]
    ↓
9. Update Customer Sync Status:
   - Success → syncStatus = SYNCED, lastSyncedAt = now
   - Failure → syncStatus = FAILED, syncError = message
    ↓
10. If Failure → Throw Error (BullMQ retries)
```

### Step-by-Step Execution

#### Step 1: Receive Event
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/event-handlers/customer-status.handler.ts`
- **Function:** `handleCustomerStatusEvent()`
- **Action:**
  - BullMQ worker picks job from event queue
  - Parse event payload
  - Validate required fields (customerId, tenantId)
  - Route to appropriate handler based on eventName
- **Database:** None
- **Events:** None

#### Step 2: Load Connection Mode
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/radius-sync-service.ts`
- **Function:** `getConnectionMode()`
- **Action:**
  - Query Settings table for key='PPP_CONNECTION_MODE'
  - Return "MIKROTIK_API" if value matches, else "RADIUS" (default)
  - RADIUS mode: Use FreeRADIUS database for authentication
  - MIKROTIK_API mode: Use MikroTik RouterOS API directly
- **Database:** `Settings` (SELECT)
- **Events:** None

#### Step 3: Load Customer Data
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/repositories/NetworkRepository.ts`
- **Function:** `findPelangganWithRouterByUsername()` or `findPelangganBasic()`
- **Action:**
  - Query Pelanggan table by ID
  - Include related data:
    - username (PPPoE login)
    - password (PPPoE password)
    - status (AKTIF, NONAKTIF, ISOLIR)
    - hargaPaketId → bandwidth profile
    - routerId (if MIKROTIK_API mode)
  - Load HargaPaket for bandwidth settings
- **Database:** `Pelanggan` (SELECT with JOINs)
- **Events:** None

#### Step 4a: RADIUS Mode - Sync to RADIUS Database
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/repositories/RadiusRepository.ts`
- **Function:** `syncPelangganToRadius()`
- **Action:**
  - Connect to RADIUS database (separate PostgreSQL database)
  - UPSERT `radcheck` table:
    - username = customer.username
    - attribute = "Cleartext-Password"
    - op = ":="
    - value = customer.password
  - UPSERT `radreply` table:
    - username = customer.username
    - attribute = "Mikrotik-Rate-Limit"
    - op = ":="
    - value = bandwidth string (e.g., "10M/10M")
  - If status = ISOLIR or NONAKTIF:
    - DELETE from radcheck and radreply
    - This prevents authentication (no credentials = access denied)
- **Database:** RADIUS DB tables: `radcheck` (INSERT/UPDATE/DELETE), `radreply` (INSERT/UPDATE/DELETE)
- **Events:** None

#### Step 4b: MikroTik API Mode - Sync to MikroTik
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/network/services/MikroTikPPPSecretService.ts`
- **Function:** `syncNewCustomer()` or `handleStatusChange()`
- **Action:**
  - Load MikroTik router for customer (by routerId or tenant default)
  - Connect to MikroTik RouterOS API:
    - Host: router.host
    - Port: router.port (default 8728)
    - Username: router.username
    - Password: router.password
  - Send API command: `/ppp/secret/print` to find existing secret by name=username
  - If Status = AKTIF:
    - If secret exists: Update (set/ppp/secret)
    - If secret not exists: Add (add/ppp/secret)
    - Set attributes:
      - name = username
      - password = customer.password
      - service = pppoe
      - profile = bandwidth profile name
      - disabled = no
  - If Status = ISOLIR/NONAKTIF:
    - If secret exists: Disable (set/ppp/secret disabled=yes)
    - OR: Change profile to "blocked" profile (0kbps bandwidth)
  - Optional: Terminate active sessions (remove/ppp/active)
- **Database:** `MikroTikRouter` (SELECT for connection info)
- **Events:** None
- **External API:** MikroTik RouterOS API (port 8728, custom protocol)

#### Step 5: Update Sync Status
- **File:** Customer status handler or service
- **Function:** `updateSyncStatus()`
- **Action:**
  - On success:
    - Update Pelanggan.syncStatus = "SYNCED"
    - Set Pelanggan.lastSyncedAt = now
    - Clear Pelanggan.syncError
    - Reset Pelanggan.syncRetryCount = 0
  - On failure:
    - Update Pelanggan.syncStatus = "FAILED"
    - Set Pelanggan.syncError = error message
    - Increment Pelanggan.syncRetryCount
    - Throw error to trigger BullMQ retry
- **Database:** `Pelanggan` (UPDATE)
- **Events:** None

#### Step 6: Retry on Failure
- **Action:**
  - If sync fails (MikroTik unreachable, RADIUS DB down, etc):
    - BullMQ catches thrown error
    - Retry with exponential backoff (e.g., 30s, 2m, 5m, 15m)
    - Max retries: Configured in BullMQ job options (e.g., 5 attempts)
  - If all retries exhausted:
    - Job moves to failed queue
    - Admin alerted (via monitoring/logs)
    - Customer shows syncStatus=FAILED in admin panel
- **Database:** None
- **Events:** None

### Database Operations
- **Tables:**
  - `Settings` (SELECT for connection mode)
  - `Pelanggan` (SELECT, UPDATE syncStatus)
  - `HargaPaket` (SELECT for bandwidth profile)
  - `MikroTikRouter` (SELECT for API connection)
  - RADIUS DB: `radcheck` (INSERT/UPDATE/DELETE)
  - RADIUS DB: `radreply` (INSERT/UPDATE/DELETE)
- **Transaction Boundary:**
  - RADIUS sync: Each table operation separate (no transaction needed)
  - Customer update: Single UPDATE (atomic)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
1. **MikroTik RouterOS API** (if MIKROTIK_API mode)
   - Protocol: Custom RouterOS API protocol over TCP
   - Port: 8728 (default) or custom
   - Authentication: Username/password per router
   - Commands: /ppp/secret/print, /ppp/secret/add, /ppp/secret/set, /ppp/active/remove
   - Timeout: 10-30 seconds per operation
   - Retry: Via BullMQ job retry mechanism

### Events Emitted
**None.** This handler consumes events, does not emit new ones.

### Side Effects
- Customer credentials added/updated in RADIUS database or MikroTik
- Customer can authenticate via PPPoE (if AKTIF)
- Customer authentication blocked (if ISOLIR/NONAKTIF)
- Active PPPoE sessions terminated (if disabled)
- Bandwidth profile applied or changed
- Sync status updated for monitoring

### Success Criteria
- Customer credentials exist in RADIUS or MikroTik
- Credentials match customer username/password
- Bandwidth profile correctly applied
- Customer can connect via PPPoE (if AKTIF)
- Customer cannot connect (if ISOLIR/NONAKTIF)
- syncStatus = SYNCED

### Failure Scenarios

#### 1. Connection Mode Setting Missing
- **Cause:** PPP_CONNECTION_MODE not in Settings table
- **Handling:** Default to RADIUS mode (backward compatible)
- **Rollback:** Not needed
- **Manual Fix:** Add setting if MikroTik API mode desired

#### 2. MikroTik API Connection Failure
- **Cause:** Router unreachable, wrong credentials, firewall blocking port 8728
- **Handling:**
  - Throw error with connection details
  - BullMQ retries (exponential backoff)
  - syncStatus = FAILED
  - syncError = "Failed to connect to MikroTik: {error}"
- **Rollback:** No database change on connection failure
- **Retry:** Yes (BullMQ automatic retry)
- **Manual Fix:**
  - Check router connectivity
  - Verify router credentials
  - Check firewall rules
  - Manually trigger sync from admin panel

#### 3. RADIUS Database Connection Failure
- **Cause:** RADIUS DB server down, wrong connection string
- **Handling:**
  - Throw error
  - BullMQ retries
  - syncStatus = FAILED
- **Rollback:** No partial state (RADIUS operations are idempotent)
- **Retry:** Yes (BullMQ automatic)
- **Manual Fix:** Restore RADIUS DB, verify connection string

#### 4. Customer Data Missing
- **Cause:** Pelanggan record deleted between event emit and processing
- **Handling:**
  - Log warning: "Customer not found"
  - Skip sync (return without error)
  - No retry needed
- **Rollback:** Not applicable
- **Retry:** No (customer doesn't exist)

#### 5. Router Not Assigned to Customer
- **Cause:** Customer.routerId null (in MIKROTIK_API mode)
- **Handling:**
  - Try to find router by tenantId (fallback to tenant default)
  - If no router found: Throw error
  - syncStatus = FAILED
  - syncError = "No router assigned"
- **Rollback:** None
- **Retry:** Yes (admin might assign router)
- **Manual Fix:** Assign router to customer in admin panel

#### 6. Bandwidth Profile Not Found
- **Cause:** Customer.hargaPaketId null or HargaPaket deleted
- **Handling:**
  - Use default bandwidth profile (e.g., "1M/1M")
  - OR: Skip sync with error
  - Log warning
- **Rollback:** None
- **Retry:** After package assigned
- **Manual Fix:** Assign valid package to customer

#### 7. MikroTik API Timeout
- **Cause:** Router slow to respond, high CPU load on router
- **Handling:**
  - Timeout after 30 seconds
  - Throw timeout error
  - BullMQ retries
- **Rollback:** None (timeout before operation completed)
- **Retry:** Yes
- **Manual Fix:** Check router performance, reduce load

### Performance Characteristics
- **Expected Duration:**
  - RADIUS mode: 50-200ms per customer (database INSERT/UPDATE)
  - MikroTik API mode: 500-2000ms per customer (API connection + command)
- **Bottlenecks:**
  - MikroTik API connection latency (network-dependent)
  - RADIUS database connection pool exhaustion
  - Sequential processing (one customer at a time per event)
- **Optimization:**
  - Batch RADIUS operations (if many customers)
  - Connection pooling for RADIUS DB
  - Reuse MikroTik API connection (persistent connection per router)
  - Parallel event processing (BullMQ concurrency)

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/network/`)
- **Test Coverage:** Unknown
- **How to Test:**
  1. **RADIUS Mode:**
     - Set PPP_CONNECTION_MODE = "RADIUS" (or remove setting)
     - Create customer with status AKTIF
     - Trigger sync (emit CUSTOMER_CREATED event or call service directly)
     - Check RADIUS DB: `SELECT * FROM radcheck WHERE username = 'customer_username'`
     - Verify password attribute exists
     - Check radreply for Mikrotik-Rate-Limit
     - Test PPPoE connection from router
  2. **MikroTik API Mode:**
     - Set PPP_CONNECTION_MODE = "MIKROTIK_API"
     - Assign router to customer
     - Trigger sync
     - SSH to MikroTik: `/ppp secret print`
     - Verify secret exists with correct password and profile
     - Test PPPoE connection
  3. **Isolation:**
     - Change customer status to ISOLIR
     - Trigger sync
     - Verify credentials removed (RADIUS) or disabled (MikroTik)
     - Test PPPoE connection - should be rejected
  4. **Retry:**
     - Stop RADIUS DB or MikroTik router
     - Trigger sync - should fail
     - Check syncStatus = FAILED
     - Restart infrastructure
     - Wait for BullMQ retry - should succeed

---

## Flow 7: Attendance Check-in Flow

### Overview
Flow ini menangani proses check-in karyawan untuk attendance tracking. Validasi lokasi (geofence), time window, duplicate check, dan evaluasi keterlambatan.

### Entry Point
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/app/api/attendance/check-in/route.ts`
- **Function:** POST handler
- **HTTP Endpoint:** `POST /api/attendance/check-in`
- **Authentication:** Required (session user)

### Authentication & Authorization
- **Session Required:** Yes (userId from session)
- **Permissions:** Typically public for all authenticated employees
- **Tenant Isolation:** tenantId from user session

### Input Validation
- **Required Fields:**
  - `latitude`: number (GPS coordinate)
  - `longitude`: number (GPS coordinate)
- **Optional Fields:**
  - `photoUrl`: string (check-in photo URL, pre-uploaded)
  - `location`: string (location name/address)
  - `notes`: string
  - `offlineTime`: ISO date string (for offline check-in sync)

### Flow Diagram

```
Employee (Mobile) → POST /api/attendance/check-in
    ↓
1. Validate Coordinates (range check)
    ↓
2. Resolve Timezone (from tenant or user setting)
    ↓
3. Determine Check-in Time (offlineTime or now)
    ↓
4. Auto-checkout Stale Sessions (previous day not checked out)
    ↓
5. Check Active Session Conflict (prevent duplicate)
    ↓
6. Validate Time Window (check-in allowed hours)
    ↓
7. Validate Eligibility (not on leave, not holiday, not off-day)
    ↓
8. Load User Attendance Settings (working hour mode, shift, schedule)
    ↓
9. Resolve Geofence Status:
   - Calculate distance to nearest site
   - INSIDE if < radius, OUTSIDE if >= radius
    ↓
10. Determine Attendance Status:
   - Compare check-in time with schedule start time
   - TEPAT_WAKTU if on time
   - TERLAMBAT if late
    ↓
11. Create Attendance Record
    ↓
12. Evaluate Attendance (calculate late duration, penalties)
    ↓
13. Emit Check-in Event (for notifications)
    ↓
14. Return Attendance + Evaluation Result
```

### Step-by-Step Execution

#### Step 1: Validate Coordinates
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceMutationService.ts`
- **Function:** `validateCoordinates()`
- **Action:**
  - Check latitude in range [-90, 90]
  - Check longitude in range [-180, 180]
  - Throw error if NaN or out of range
- **Database:** None
- **Events:** None

#### Step 2: Resolve Timezone
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceTimezoneService.ts`
- **Function:** `getTimezone()`
- **Action:**
  - Check user.timezone (if set)
  - Else query Settings for tenant timezone
  - Default to "Asia/Jakarta" if not found
- **Database:** `User` (SELECT), `Settings` (SELECT)
- **Events:** None

#### Step 3: Determine Check-in Time
- **File:** Attendance service helpers
- **Function:** `resolveCheckInTimeContext()`
- **Action:**
  - If offlineTime provided: Use offlineTime (for offline sync)
  - Else: Use current server time
  - Calculate effectiveToday in user timezone (for checkInDate field)
- **Database:** None
- **Events:** None

#### Step 4: Auto-checkout Stale Sessions
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceSessionGuardService.ts`
- **Function:** `processAutoCheckout()`
- **Action:**
  - Find attendance records for user where:
    - checkOut IS NULL (not checked out)
    - checkInDate < today (previous days)
  - For each stale session:
    - Set checkOut = end of day (e.g., 23:59:59)
    - Set status = ALPHA or INCOMPLETE (configurable)
    - Log auto-checkout reason
- **Database:** `Attendance` (SELECT, UPDATE)
- **Events:** None

#### Step 5: Check Active Session Conflict
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceSessionGuardService.ts`
- **Function:** `assertNoActiveSessionConflict()`
- **Action:**
  - Query Attendance table for user where:
    - checkInDate = today
    - checkOut IS NULL (active session)
  - If found: Throw error "DUPLICATE_ENTRY"
  - Prevents duplicate check-in on same day
- **Database:** `Attendance` (SELECT)
- **Events:** None

#### Step 6: Validate Time Window
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceValidationService.ts`
- **Function:** `validateCheckInTimeWindow()`
- **Action:**
  - Load check-in window settings (e.g., "CHECK_IN_WINDOW_START" = "04:00", "CHECK_IN_WINDOW_END" = "12:00")
  - Check if current time within window
  - If outside window: Throw error with allowed range
  - Prevents check-in at unrealistic times (e.g., midnight)
- **Database:** `Settings` (SELECT)
- **Events:** None

#### Step 7: Validate Eligibility
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceValidationService.ts`
- **Function:** `validateCheckInEligibility()`
- **Action:**
  - Check if user on approved leave today (query Leave table)
  - Check if today is company holiday (query Holidays table)
  - Check if today is user's off-day (based on schedule/shift)
  - If any condition true: Throw error "ON_LEAVE" or "HOLIDAY" or "OFF_DAY"
- **Database:** `Leave` (SELECT), `Holidays` (SELECT), `User` schedule
- **Events:** None

#### Step 8: Load User Attendance Settings
- **File:** Attendance service helpers
- **Function:** `getCachedUserAttendanceSettings()`
- **Action:**
  - Query User table with related data:
    - workingHourMode (FIXED, FLEXIBLE, SHIFT)
    - startWorkTime, endWorkTime (for FIXED mode)
    - flexibleTargetHour (for FLEXIBLE mode)
    - shiftId (for SHIFT mode)
  - Load Shift data if SHIFT mode
  - Cache result (prevent repeated queries)
- **Database:** `User` (SELECT), `Shift` (SELECT)
- **Events:** None

#### Step 9: Resolve Geofence Status
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceMutationGeofenceService.ts`
- **Function:** `resolveCheckInGeofence()`
- **Action:**
  - Load user's assigned sites (office locations)
  - For each site:
    - Calculate distance using Haversine formula: distance(userLat, userLng, siteLat, siteLng)
  - Find nearest site
  - Compare distance with site.geofenceRadius (e.g., 100 meters)
  - If distance < radius: geofenceStatus = INSIDE
  - Else: geofenceStatus = OUTSIDE
  - Store: geofenceDistance, geofenceSiteName
- **Database:** `Site` (SELECT)
- **Events:** None

#### Step 10: Determine Attendance Status
- **File:** Attendance service helpers
- **Function:** `resolveCheckInStatus()`
- **Action:**
  - Get expected start time based on working hour mode:
    - FIXED: user.startWorkTime (e.g., 08:00)
    - SHIFT: shift.startTime
    - FLEXIBLE: No fixed start (always TEPAT_WAKTU on check-in)
  - Compare check-in time with expected start time
  - If check-in <= start time: status = TEPAT_WAKTU
  - If check-in > start time: status = TERLAMBAT
  - Calculate late duration in minutes
- **Database:** None (uses cached user data)
- **Events:** None

#### Step 11: Create Attendance Record
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceMutationService.ts`
- **Function:** `createCheckInAttendance()`
- **Action:**
  - Generate UUID for attendance ID
  - Insert Attendance record:
    - userId
    - tenantId
    - checkIn = check-in time
    - checkInDate = effective date (in user timezone)
    - checkInPhoto = photoUrl
    - location = location string
    - notes
    - status (TEPAT_WAKTU or TERLAMBAT)
    - geofenceStatus (INSIDE or OUTSIDE)
    - geofenceDistance
    - geofenceSiteName
    - geofenceMeta (offline flag if offlineTime)
- **Database:** `Attendance` (INSERT)
- **Events:** None yet

#### Step 12: Evaluate Attendance
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceEvaluationRecomputeService.ts`
- **Function:** `recomputeAttendanceEvaluation()`
- **Action:**
  - Calculate detailed evaluation:
    - Late duration (if TERLAMBAT)
    - Expected work hours (based on mode)
    - Penalties (if configured)
    - Warnings (e.g., "Anda check-in diluar area kantor")
  - Return evaluation object with breakdown
- **Database:** None (calculation only)
- **Events:** None

#### Step 13: Emit Check-in Event
- **File:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceMutationEventService.ts`
- **Function:** `publishCheckInEvent()`
- **Action:**
  - Emit event: "ATTENDANCE_CHECKIN"
  - Payload: { attendanceId, userId, checkInTime, status, geofenceStatus, tenantId }
  - Can trigger notifications to supervisor
- **Database:** `EventOutbox` (INSERT) or direct BullMQ dispatch
- **Events:** ATTENDANCE_CHECKIN

#### Step 14: Return Result
- **Action:**
  - Return response with:
    - attendance: Full attendance record
    - evaluation: Evaluation breakdown (late duration, penalties, warnings)
  - HTTP 201 Created
- **Database:** None
- **Events:** None

### Database Operations
- **Tables:**
  - `User` (SELECT for settings and schedule)
  - `Settings` (SELECT for timezone, time window)
  - `Attendance` (SELECT for duplicate check, INSERT new, UPDATE stale sessions)
  - `Leave` (SELECT for eligibility check)
  - `Holidays` (SELECT for eligibility check)
  - `Shift` (SELECT if SHIFT mode)
  - `Site` (SELECT for geofence calculation)
  - `EventOutbox` (INSERT for check-in event)
- **Transaction Boundary:**
  - Auto-checkout + insert: Could be single transaction (but currently separate)
  - Insert attendance: Single INSERT (atomic)
- **Isolation Level:** Default (READ COMMITTED)

### External API Calls
**None.** All operations are internal.

### Events Emitted
1. **ATTENDANCE_CHECKIN**
   - Payload: { attendanceId, userId, checkInTime, status, geofenceStatus, tenantId }
   - Handlers: Notification service (notify supervisor if late or outside geofence)

### Side Effects
- Attendance record created
- Previous day stale sessions auto-checked-out
- Check-in event emitted for notifications
- User can now check out later to complete attendance

### Success Criteria
- Attendance record created with correct status
- Geofence status accurately determined
- Late duration calculated correctly (if applicable)
- No duplicate check-in allowed
- Eligibility validated (not on leave/holiday)

### Failure Scenarios

#### 1. Invalid Coordinates (HTTP 400)
- **Cause:** Latitude/longitude out of valid range or NaN
- **Handling:** Return 400 with error message
- **Rollback:** Not needed (no database operation)
- **User Action:** Check GPS permissions, retry with valid coordinates

#### 2. Duplicate Check-in (HTTP 409)
- **Cause:** User already checked in today (active session exists)
- **Handling:** Return 409 "DUPLICATE_ENTRY"
- **Rollback:** Not needed
- **User Action:** Use existing check-in, or contact admin to reset

#### 3. Outside Time Window (HTTP 400)
- **Cause:** Check-in attempted outside allowed hours (e.g., at 2 AM)
- **Handling:** Return 400 with allowed time range
- **Rollback:** Not needed
- **User Action:** Wait until time window opens, or contact admin for exception

#### 4. On Leave/Holiday (HTTP 403)
- **Cause:** User has approved leave or today is holiday
- **Handling:** Return 403 with reason
- **Rollback:** Not needed
- **User Action:** User should not check-in on leave/holiday

#### 5. GPS Not Available (Client-side)
- **Cause:** User denied GPS permission or GPS unavailable
- **Handling:** Mobile app shows error
- **Rollback:** Not applicable (request not sent)
- **User Action:** Enable GPS, grant permission

#### 6. Offline Check-in (Handled gracefully)
- **Cause:** No internet connection during check-in
- **Handling:**
  - Mobile app stores check-in locally with timestamp
  - When connection restored, sync with offlineTime parameter
  - Server accepts offlineTime and uses it for evaluation
  - Geofence and time validation still apply
- **Rollback:** Not needed
- **User Action:** Wait for connection, app auto-syncs

### Performance Characteristics
- **Expected Duration:** 200-500ms total
  - Validation: 50-100ms
  - Geofence calculation: 50-150ms
  - Database insert: 20-50ms
  - Evaluation: 20-50ms
- **Bottlenecks:**
  - Multiple database queries (user, settings, leave, holidays, site)
  - Geofence calculation (Haversine formula for multiple sites)
- **Optimization:**
  - Cache user settings (already implemented)
  - Cache site locations
  - Index Attendance table on (userId, checkInDate, checkOut)
  - Batch queries where possible

### Testing
- **Test Files:** Unknown (needs verification in `/tests/modules/attendance/`)
- **Test Coverage:** Unknown
- **How to Test:**
  1. **Happy Path:**
     - Login as employee
     - POST to check-in endpoint with valid GPS coordinates near office
     - Verify attendance created with status TEPAT_WAKTU
     - Verify geofenceStatus = INSIDE
  2. **Late Check-in:**
     - Check-in after schedule start time
     - Verify status = TERLAMBAT
     - Verify late duration calculated correctly
  3. **Outside Geofence:**
     - Check-in with coordinates far from office
     - Verify geofenceStatus = OUTSIDE
     - Verify warning in evaluation result
  4. **Duplicate Prevention:**
     - Check-in twice on same day
     - Second attempt should return 409 error
  5. **On Leave:**
     - Create approved leave for today
     - Attempt check-in - should return 403
  6. **Time Window:**
     - Attempt check-in at 2 AM (outside window)
     - Should return 400 with allowed range
  7. **Offline Sync:**
     - Simulate offline check-in with offlineTime parameter
     - Verify server uses offlineTime for evaluation

---

## Cross-Flow Dependencies

### Payment → Customer Activation → Network Provisioning
**Flow:** Payment Webhook → Invoice Paid → Customer Activated → RADIUS/MikroTik Sync

**Dependency Chain:**
1. Payment webhook updates invoice to PAID
2. INVOICE_PAID event emitted
3. InvoicePaidActivationHandler checks eligibility and activates customer
4. CUSTOMER_ACTIVATED event emitted
5. CustomerStatusHandler syncs to network infrastructure

**Failure Impact:**
- If network sync fails, customer shows as AKTIF but has no internet access
- Mitigation: Retry mechanism via BullMQ, manual sync from admin panel

### Invoice Generation → Auto-Isolir
**Flow:** Invoice Generation → Billing Schedule Creation → Overdue Processing → Customer Isolation

**Dependency Chain:**
1. Daily invoice generation creates Invoice records
2. BillingSchedule created for each invoice (reminders + isolation)
3. Reconciliation cron processes overdue schedules
4. Customer status changed to ISOLIR
5. Network sync disables access

**Failure Impact:**
- If isolation fails, customer retains access despite overdue payment
- Mitigation: Retry mechanism, manual isolation from admin panel

### Work Order Completion → Inventory Update
**Flow:** Work Order Completed → Admin Verification → Inventory Deduction

**Dependency Chain:**
1. Technician completes work order with materials used
2. Admin verifies completion
3. Inventory stock reduced
4. InventoryTransaction created for audit

**Failure Impact:**
- If inventory update fails, stock count inaccurate
- Mitigation: Transaction boundary ensures atomicity, manual adjustment if needed

### Registration → Customer Creation → Invoice Generation
**Flow:** Registration Approved → Customer Created → First Invoice → Payment → Activation

**Dependency Chain:**
1. Admin approves registration, creates customer record
2. Customer status set based on payment model (PRABAYAR vs REGULER)
3. For PRABAYAR: Immediate invoice generation
4. Payment received → Activation
5. Network provisioning

**Failure Impact:**
- Registration isolated from main flows (manual approval process)
- Once customer created, follows standard activation flow

## Common Patterns

### Event-Driven Architecture
**Pattern:** Domain events dispatched via EventOutbox → BullMQ → Event handlers

**Usage:**
- INVOICE_PAID → Customer activation
- CUSTOMER_ACTIVATED → Network sync
- ATTENDANCE_CHECKIN → Notifications

**Benefits:**
- Decoupling between modules
- Async processing (non-blocking)
- Retry mechanism built-in
- Audit trail via event log

**Trade-offs:**
- Eventual consistency (small delay between event and effect)
- Need to handle duplicate events (idempotency)
- Debugging harder (distributed flow)

### Idempotency Guards
**Pattern:** Check-before-action with unique constraints

**Usage:**
- Webhook idempotency (idempotency key)
- Invoice generation (check existing before create)
- Attendance check-in (active session check)
- Network sync (upsert operations)

**Implementation:**
- Database unique constraints
- Explicit SELECT before INSERT
- Idempotency key tables

### Batch Processing with Pagination
**Pattern:** Process large datasets in chunks with offset pagination

**Usage:**
- Invoice generation (100 customers per batch)
- Auto-isolir reconciliation (process schedules in batches)

**Benefits:**
- Memory efficient
- Can resume if interrupted
- Garbage collection between batches

**Implementation:**
```typescript
let offset = 0;
while (true) {
  const batch = await repository.find({ limit: 100, offset });
  if (batch.length === 0) break;
  
  await processBatch(batch);
  offset += 100;
  triggerGarbageCollection();
}
```

### Status Transition with Guards
**Pattern:** Validate state transitions before allowing status change

**Usage:**
- Registration status (PENDING → VERIFIED → SURVEYED → INSTALLED)
- Work order status (REQUESTED → OPEN → IN_PROGRESS → COMPLETED)
- Customer status (NONAKTIF → AKTIF → ISOLIR)

**Implementation:**
```typescript
const VALID_TRANSITIONS = {
  PENDING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["SURVEYED"],
  // ...
};

if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
  throw new Error("Invalid transition");
}
```

### Retry with Exponential Backoff
**Pattern:** Retry failed operations with increasing delays

**Usage:**
- Network sync failures
- External API calls
- Event handler failures

**Implementation:**
- BullMQ built-in retry mechanism
- Backoff: 30s, 2m, 5m, 15m, 30m
- Max attempts: Configurable (typically 5-10)
- Move to dead letter queue after exhaustion

### Dual-Write Problem Mitigation
**Pattern:** Write to EventOutbox atomically with main operation

**Usage:**
- Payment webhook: Update Payment + Invoice + Emit INVOICE_PAID (single transaction)
- Ensures event not lost even if dispatch fails

**Implementation:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.payment.update({ ... });
  await tx.invoice.update({ ... });
  await saveToOutboxTx(tx, { eventName: "INVOICE_PAID", ... });
});
// Separate process polls EventOutbox and dispatches to queue
```

### Geofence Validation
**Pattern:** Calculate distance between two GPS coordinates using Haversine formula

**Usage:**
- Attendance check-in/check-out
- Work order location verification

**Implementation:**
```typescript
const distance = haversine(userLat, userLng, siteLat, siteLng);
const status = distance <= site.geofenceRadius ? "INSIDE" : "OUTSIDE";
```

### Multi-Tenant Data Isolation
**Pattern:** Filter all queries by tenantId

**Usage:**
- All modules (customer, invoice, attendance, etc)
- Enforced at repository layer
- Prevents cross-tenant data leakage

**Implementation:**
```typescript
await prisma.pelanggan.findMany({
  where: {
    tenantId: userSession.tenantId,
    // ... other filters
  }
});
```

---

**End of Critical Flows Documentation**

**Total Flows Documented:** 7

1. Customer Registration & Activation
2. Payment Processing (Webhook)
3. Auto-Isolir (Overdue Billing)
4. Work Order Lifecycle
5. Invoice Generation (Recurring)
6. Network Provisioning
7. Attendance Check-in

**Key Takeaways:**
- Event-driven architecture heavily used for decoupling
- Retry mechanisms essential for reliability (network sync, external APIs)
- Idempotency guards prevent duplicate processing
- Batch processing for scalability (invoice generation)
- Multi-tenant isolation enforced at all layers
- Transaction boundaries carefully designed for consistency
- Async processing via BullMQ for non-blocking operations
- Geofence validation for location-based features
