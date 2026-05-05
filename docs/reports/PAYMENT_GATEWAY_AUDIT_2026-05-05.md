# Payment Gateway Module - Audit Report

**Tanggal:** 2026-05-05  
**Auditor:** Claude (Sonnet 4.6)  
**Lokasi:** `modules/finance/services/payment-gateway/`

---

## Executive Summary

Modul payment-gateway saat ini **TIDAK sesuai** dengan standar Clean Architecture yang ditargetkan. Modul ini masih menggunakan pola lama dengan beberapa pelanggaran arsitektur yang signifikan.

**Status:** ❌ **Memerlukan Refactoring Penuh**

**Severity:** 🔴 **HIGH** - Modul ini adalah infrastruktur kritis yang menangani integrasi payment gateway eksternal.

---

## Struktur Saat Ini

```
modules/finance/services/payment-gateway/
├── gateway-manager.ts                          # Service orchestrator
├── payment-method-catalog.ts                   # Static catalog
├── provider-factory.ts                         # Factory pattern
├── provider-interface.ts                       # Interface definition
├── webhook-invoice-settlement-service.ts       # Business logic
├── webhook-payment-lookup-service.ts           # Business logic
├── webhook-processing-service.ts               # Business logic
├── webhook-utils.ts                            # Utilities
└── providers/
    ├── xendit-provider.ts                      # 215 lines
    ├── midtrans-provider.ts                    # 209 lines
    ├── duitku-provider.ts                      # 254 lines
    ├── tripay-provider.ts                      # 266 lines
    ├── bri-provider.ts                         # 297 lines
    ├── bca-provider.ts                         # 249 lines
    ├── dana-provider.ts                        # 201 lines
    ├── moota-provider.ts                       # 178 lines
    ├── *-provider-helpers.ts                   # Helper files
    └── *-provider-utils.ts                     # Utility files
```

---

## Pelanggaran Arsitektur

### 🔴 CRITICAL: Lokasi Module Salah

**Masalah:**
```
modules/finance/services/payment-gateway/  ❌ SALAH
```

**Seharusnya:**
```
modules/payment-gateway/                   ✅ BENAR
├── domain/
├── dto/
├── repositories/
├── services/
└── validators/
```

**Alasan:**
- Payment gateway adalah **bounded context tersendiri**, bukan sub-modul dari finance
- Finance module seharusnya hanya **menggunakan** payment gateway, bukan **memiliki** implementasinya
- Ini melanggar prinsip **Separation of Concerns** dan **Single Responsibility**

**Dampak:**
- Coupling tinggi antara finance dan payment gateway
- Sulit untuk reuse payment gateway di module lain (misal: procurement, salary)
- Melanggar dependency rule: finance bergantung pada detail implementasi payment gateway

---

### 🔴 CRITICAL: Missing Domain Layer

**Masalah:**
- Tidak ada `domain/entities/` untuk payment gateway domain objects
- Tidak ada `domain/ports/` untuk repository interfaces
- Business logic tercampur dengan infrastructure code

**Yang Hilang:**
```typescript
// domain/entities/PaymentGatewayTransaction.ts
export interface PaymentGatewayTransaction {
  orderId: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  transactionId?: string;
  // ... pure domain properties
}

// domain/ports/IPaymentGatewayRepository.ts
export interface IPaymentGatewayRepository {
  saveTransaction(tx: PaymentGatewayTransaction): Promise<void>;
  findByOrderId(orderId: string): Promise<PaymentGatewayTransaction | null>;
}
```

**Dampak:**
- Tidak ada clear boundary antara domain logic dan infrastructure
- Sulit untuk testing karena tightly coupled dengan external APIs
- Melanggar Dependency Inversion Principle

---

### 🟡 MEDIUM: Service Layer Issues

**Masalah di `WebhookProcessingService`:**

```typescript
// Line 180-228: Direct database access di service
await prismaBillingAuth.$transaction(async (tx) => {
  const currentPayment = await tx.payment.findUnique({
    where: { id: payment.id },
  });
  // ... direct Prisma operations
});
```

**Pelanggaran:**
- Service langsung akses Prisma client
- Seharusnya melalui repository layer
- Business logic tercampur dengan data access logic

**Seharusnya:**
```typescript
// Gunakan repository
await this.paymentRepository.updatePaymentStatus({
  paymentId: payment.id,
  status: gatewayStatus,
  transactionId: webhookResult.transactionId,
});
```

---

### 🟡 MEDIUM: Missing DTO Layer

**Masalah:**
- Tidak ada DTO untuk input/output validation
- Interface `CreatePaymentParams`, `PaymentResult`, dll. ada di `provider-interface.ts`
- Tidak ada Zod schema untuk validation

**Yang Hilang:**
```typescript
// dto/CreatePaymentRequest.dto.ts
export const CreatePaymentRequestSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().regex(/^(\+62|62|0)[0-9]{9,12}$/),
  description: z.string(),
  expiryHours: z.number().positive().optional(),
  paymentMethods: z.array(z.string()).optional(),
  tenantId: z.string().optional(),
});

export type CreatePaymentRequestDto = z.infer<typeof CreatePaymentRequestSchema>;
```

**Dampak:**
- Tidak ada runtime validation
- Risiko invalid data masuk ke provider
- Sulit untuk maintain contract antara layers

---

### 🟡 MEDIUM: Provider Implementation Issues

**Masalah di Provider Classes:**

1. **Type Safety Issues:**
```typescript
// xendit-provider.ts line 22
private xendit: unknown = null;  // ❌ Should be properly typed

// midtrans-provider.ts line 23-24
private snap: unknown = null;     // ❌ Should be properly typed
private coreApi: unknown = null;  // ❌ Should be properly typed
```

2. **Error Handling Inconsistent:**
```typescript
// Beberapa provider return error object
return { success: false, error: "..." };

// Beberapa throw error
throw new Error("...");
```

3. **Missing Retry Logic:**
- Tidak ada retry mechanism untuk transient failures
- Tidak ada circuit breaker pattern
- Tidak ada timeout handling

---

### 🟢 LOW: Code Organization

**Masalah:**
- Terlalu banyak helper files (`*-helpers.ts`, `*-utils.ts`)
- Tidak jelas mana yang pure function, mana yang stateful
- Naming inconsistent: `helpers` vs `utils`

**Contoh:**
```
providers/
├── xendit-provider-helpers.ts      # 78 lines
├── midtrans-provider-helpers.ts    # 104 lines
├── dana-provider-helpers.ts        # 249 lines
├── dana-provider-utils.ts          # 56 lines
├── bca-provider-utils.ts           # 176 lines
└── ...
```

**Seharusnya:**
- Consolidate ke dalam provider class atau extract ke shared utilities
- Gunakan naming yang konsisten

---

## Code Smells Detected

### 1. God Class: `WebhookProcessingService`

**Lines:** 289 lines  
**Responsibilities:**
- Webhook signature verification
- Payload parsing
- Payment lookup (early & late)
- Gateway manager orchestration
- Database transaction management
- Invoice settlement orchestration
- Unmatched mutation recording

**Refactor:**
```
WebhookProcessingService (Orchestrator)
├── WebhookVerificationService
├── WebhookPayloadParser
├── PaymentLookupService (sudah ada)
├── PaymentStatusUpdater (new)
└── InvoiceSettlementService (sudah ada)
```

---

### 2. Magic Strings

```typescript
// webhook-processing-service.ts line 22-31
const SIGNATURE_HEADERS = {
  XENDIT: "x-callback-token",
  MIDTRANS: "",
  TRIPAY: "x-callback-signature",
  // ...
};

// Seharusnya di domain constants
export const PAYMENT_GATEWAY_PROVIDERS = {
  XENDIT: {
    name: 'Xendit',
    signatureHeader: 'x-callback-token',
    // ...
  },
  // ...
} as const;
```

---

### 3. Deep Nesting

```typescript
// webhook-processing-service.ts line 180-228
await prismaBillingAuth.$transaction(async (tx) => {
  const currentPayment = await tx.payment.findUnique({ ... });
  if (currentPayment?.gatewayStatus === "PAID") {
    return;  // Early return di dalam nested callback
  }
  
  if (hasTransactionMismatch(...)) {
    return;  // Another early return
  }
  
  const paymentUpdate: Prisma.PaymentUpdateInput = { ... };
  
  const normalizedPaymentMethod = normalizePaymentMethod(...);
  if (normalizedPaymentMethod) {
    paymentUpdate.paymentMethod = normalizedPaymentMethod;
  }
  
  if (webhookResult.paidAt) {
    paymentUpdate.paymentDate = webhookResult.paidAt;
  }
  
  await tx.payment.update({ ... });
  
  if (gatewayStatus === "PAID") {
    await this.invoiceSettlementService.updateInvoicesOnPaymentTx(...);
  }
});
```

**Refactor:** Extract ke method terpisah dengan clear responsibility.

---

### 4. Inconsistent Error Handling

```typescript
// xendit-provider.ts line 56-63
catch (error: unknown) {
  logger.error("Xendit createPayment error:", error);
  return {
    success: false,
    error: error instanceof Error ? error.message : "Failed to create payment",
  };
}

// vs

// xendit-provider.ts line 88-90
catch (error: unknown) {
  logger.error("Xendit checkStatus error:", error);
  throw error;  // ❌ Inconsistent: throw vs return
}
```

---

## Missing Features

### 1. ❌ No Idempotency Key Support
- Webhook bisa dipanggil multiple times
- Tidak ada idempotency key untuk prevent duplicate processing
- Risk: double payment settlement

### 2. ❌ No Audit Trail
- Tidak ada logging untuk setiap webhook event
- Sulit untuk debugging payment issues
- Tidak ada history tracking

### 3. ❌ No Rate Limiting
- Tidak ada protection dari webhook spam
- Bisa overwhelm database dengan concurrent requests

### 4. ❌ No Monitoring/Metrics
- Tidak ada metrics untuk success/failure rate
- Tidak ada alerting untuk payment gateway downtime
- Tidak ada latency tracking

### 5. ❌ No Retry Queue
- Failed webhook processing langsung lost
- Tidak ada dead letter queue
- Tidak ada manual retry mechanism

---

## Security Issues

### 🔴 CRITICAL: Webhook Signature Verification

```typescript
// webhook-processing-service.ts line 108
const signature = this.extractSignature(providerType, input.headers);

// Line 115-120
const webhookResult = await this.gatewayManager.processWebhook(
  providerType,
  payload,
  signature,  // ⚠️ Signature bisa undefined
  input.rawBody,
  payment?.tenantId || undefined,
);
```

**Masalah:**
- Signature verification tidak mandatory untuk semua providers
- Beberapa provider punya empty string di `SIGNATURE_HEADERS`
- Bisa bypass verification dengan provider yang tidak enforce signature

**Fix:**
```typescript
// Enforce signature verification
if (!signature && REQUIRES_SIGNATURE[providerType]) {
  return {
    status: 401,
    body: { error: "Missing signature" },
  };
}
```

---

### 🟡 MEDIUM: API Key Decryption

```typescript
// gateway-manager.ts line 70-72
const apiSecret = config.apiSecret
  ? decryptApiKey(config.apiSecret)
  : undefined;
```

**Masalah:**
- Decryption error tidak di-handle
- Jika decryption gagal, provider akan initialize dengan invalid key
- Tidak ada validation setelah decryption

---

## Performance Issues

### 1. N+1 Query Problem

```typescript
// webhook-processing-service.ts line 109-112
let payment = await this.paymentLookupService.findPaymentByEarlyOrderId({
  providerType,
  payload,
  tenantId: input.tenantId,
});

// Line 127-131
if (!payment) {
  payment = await this.paymentLookupService.findPaymentAfterWebhook({
    providerType,
    webhookResult,
    tenantId: input.tenantId,
  });
}
```

**Masalah:**
- Dua sequential queries untuk find payment
- Bisa di-optimize dengan single query atau caching

---

### 2. Missing Caching

```typescript
// gateway-manager.ts line 23-24
async getEnabledProviders() {
  return this.configRepository.findEnabled();
}
```

**Masalah:**
- Config di-fetch dari database setiap kali
- Config jarang berubah, seharusnya di-cache
- Bisa gunakan Redis dengan TTL 1 hour

---

## Testing Issues

### ❌ No Tests Found

```bash
$ find modules/finance/services/payment-gateway -name "*.test.ts" -o -name "*.spec.ts"
# No results
```

**Missing:**
- Unit tests untuk setiap provider
- Integration tests untuk webhook processing
- E2E tests untuk payment flow
- Mock tests untuk external API calls

**Target Coverage:**
- Business logic (services): minimum 70%
- Critical path (webhook processing): minimum 90%

---

## Rekomendasi Refactoring

### Phase 1: Extract Module (Priority: HIGH)

**Tujuan:** Pisahkan payment-gateway menjadi module independen

**Steps:**
1. Create new module structure:
```
modules/payment-gateway/
├── domain/
│   ├── entities/
│   │   ├── PaymentGatewayTransaction.ts
│   │   ├── PaymentGatewayConfig.ts
│   │   └── WebhookEvent.ts
│   ├── ports/
│   │   ├── IPaymentGatewayRepository.ts
│   │   ├── IPaymentGatewayConfigRepository.ts
│   │   └── IWebhookEventRepository.ts
│   └── value-objects/
│       ├── PaymentStatus.ts
│       ├── PaymentMethod.ts
│       └── ProviderType.ts
├── dto/
│   ├── CreatePaymentRequest.dto.ts
│   ├── PaymentResponse.dto.ts
│   ├── WebhookPayload.dto.ts
│   └── index.ts
├── repositories/
│   ├── PaymentGatewayRepository.ts
│   ├── PaymentGatewayConfigRepository.ts
│   └── WebhookEventRepository.ts
├── services/
│   ├── PaymentGatewayService.ts
│   ├── WebhookProcessingService.ts
│   ├── ProviderManager.ts
│   └── providers/
│       ├── IPaymentProvider.ts
│       ├── XenditProvider.ts
│       ├── MidtransProvider.ts
│       └── ...
├── validators/
│   ├── CreatePaymentRequest.validator.ts
│   └── WebhookPayload.validator.ts
└── index.ts
```

2. Move existing files ke struktur baru
3. Update imports di finance module
4. Add proper dependency injection

**Estimasi:** 2-3 hari

---

### Phase 2: Add Domain Layer (Priority: HIGH)

**Tujuan:** Implement proper domain entities dan ports

**Steps:**
1. Create domain entities:
```typescript
// domain/entities/PaymentGatewayTransaction.ts
export interface PaymentGatewayTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: ProviderType;
  transactionId?: string;
  paymentUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

2. Create repository ports:
```typescript
// domain/ports/IPaymentGatewayRepository.ts
export interface IPaymentGatewayRepository {
  save(tx: PaymentGatewayTransaction): Promise<void>;
  findByOrderId(orderId: string): Promise<PaymentGatewayTransaction | null>;
  findByTransactionId(txId: string): Promise<PaymentGatewayTransaction | null>;
  updateStatus(id: string, status: PaymentStatus): Promise<void>;
}
```

3. Implement repositories
4. Update services to use repositories

**Estimasi:** 2-3 hari

---

### Phase 3: Add DTO & Validation (Priority: MEDIUM)

**Tujuan:** Add proper input/output validation dengan Zod

**Steps:**
1. Create DTO schemas:
```typescript
// dto/CreatePaymentRequest.dto.ts
export const CreatePaymentRequestSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().regex(/^(\+62|62|0)[0-9]{9,12}$/),
  description: z.string(),
  expiryHours: z.number().positive().optional().default(24),
  paymentMethods: z.array(z.string()).optional(),
  tenantId: z.string().optional(),
});
```

2. Add validators:
```typescript
// validators/CreatePaymentRequest.validator.ts
export function validateCreatePaymentRequest(
  data: unknown
): Result<CreatePaymentRequestDto, ValidationError> {
  const result = CreatePaymentRequestSchema.safeParse(data);
  if (!result.success) {
    return err(new ValidationError(result.error));
  }
  return ok(result.data);
}
```

3. Update services to use validators
4. Update API routes to validate input

**Estimasi:** 1-2 hari

---

### Phase 4: Refactor Services (Priority: MEDIUM)

**Tujuan:** Break down god classes, improve error handling

**Steps:**
1. Extract `WebhookVerificationService`:
```typescript
export class WebhookVerificationService {
  verify(
    provider: ProviderType,
    payload: unknown,
    signature?: string,
    rawBody?: string
  ): Result<void, WebhookVerificationError> {
    // Verification logic
  }
}
```

2. Extract `PaymentStatusUpdater`:
```typescript
export class PaymentStatusUpdater {
  async updateFromWebhook(
    payment: PaymentEntity,
    webhookResult: WebhookResult
  ): Promise<Result<void, UpdateError>> {
    // Update logic
  }
}
```

3. Simplify `WebhookProcessingService` menjadi orchestrator
4. Add proper error handling dengan `Result<T, E>` pattern
5. Add retry logic dengan exponential backoff

**Estimasi:** 3-4 hari

---

### Phase 5: Add Missing Features (Priority: MEDIUM)

**Tujuan:** Add idempotency, audit trail, monitoring

**Steps:**
1. Add idempotency key support:
```typescript
// domain/entities/WebhookEvent.ts
export interface WebhookEvent {
  id: string;
  idempotencyKey: string;  // provider + transactionId
  provider: ProviderType;
  payload: unknown;
  signature?: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}
```

2. Add audit trail:
```typescript
// services/WebhookAuditService.ts
export class WebhookAuditService {
  async logWebhookEvent(event: WebhookEvent): Promise<void> {
    // Log to database
  }
}
```

3. Add monitoring:
```typescript
// services/PaymentGatewayMetrics.ts
export class PaymentGatewayMetrics {
  recordWebhookReceived(provider: string): void;
  recordWebhookProcessed(provider: string, duration: number): void;
  recordWebhookFailed(provider: string, error: string): void;
}
```

4. Add retry queue dengan Bull/BullMQ

**Estimasi:** 3-4 hari

---

### Phase 6: Add Tests (Priority: HIGH)

**Tujuan:** Achieve minimum 70% coverage

**Steps:**
1. Unit tests untuk providers:
```typescript
// services/providers/__tests__/XenditProvider.test.ts
describe('XenditProvider', () => {
  it('should create payment successfully', async () => {
    // Test implementation
  });
  
  it('should verify webhook signature', () => {
    // Test implementation
  });
});
```

2. Integration tests untuk webhook processing:
```typescript
// services/__tests__/WebhookProcessingService.integration.test.ts
describe('WebhookProcessingService Integration', () => {
  it('should process xendit webhook end-to-end', async () => {
    // Test with real database
  });
});
```

3. E2E tests untuk payment flow:
```typescript
// __tests__/e2e/payment-flow.e2e.test.ts
describe('Payment Flow E2E', () => {
  it('should create payment and process webhook', async () => {
    // Full flow test
  });
});
```

**Estimasi:** 4-5 hari

---

### Phase 7: Security Hardening (Priority: HIGH)

**Tujuan:** Fix security vulnerabilities

**Steps:**
1. Enforce signature verification:
```typescript
const SIGNATURE_REQUIRED = {
  XENDIT: true,
  MIDTRANS: true,
  TRIPAY: true,
  DUITKU: false,  // Duitku tidak support signature
  BRI: true,
  BCA: true,
  DANA: true,
  MOOTA: true,
};

if (SIGNATURE_REQUIRED[provider] && !signature) {
  return err(new WebhookVerificationError('Missing signature'));
}
```

2. Add rate limiting:
```typescript
// middleware/webhook-rate-limiter.ts
export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute per IP
  message: 'Too many webhook requests',
});
```

3. Add request validation:
```typescript
// Validate content-type
if (req.headers['content-type'] !== 'application/json') {
  return res.status(400).json({ error: 'Invalid content-type' });
}

// Validate payload size
if (req.body.length > 1024 * 1024) { // 1MB
  return res.status(413).json({ error: 'Payload too large' });
}
```

4. Add IP whitelist untuk webhook endpoints (optional)

**Estimasi:** 1-2 hari

---

### Phase 8: Performance Optimization (Priority: LOW)

**Tujuan:** Improve performance dengan caching dan optimization

**Steps:**
1. Add Redis caching untuk gateway config:
```typescript
// services/PaymentGatewayConfigCache.ts
export class PaymentGatewayConfigCache {
  private readonly TTL = 3600; // 1 hour
  
  async getEnabledProviders(): Promise<PaymentGatewayConfig[]> {
    const cached = await redis.get('gateway:enabled');
    if (cached) return JSON.parse(cached);
    
    const providers = await this.repository.findEnabled();
    await redis.setex('gateway:enabled', this.TTL, JSON.stringify(providers));
    return providers;
  }
}
```

2. Optimize payment lookup:
```typescript
// Combine two queries into one
const payment = await this.repository.findByOrderIdOrTransactionId({
  orderId: webhookResult.orderId,
  transactionId: webhookResult.transactionId,
  tenantId,
});
```

3. Add database indexes:
```sql
CREATE INDEX idx_payment_order_id ON payment(order_id);
CREATE INDEX idx_payment_transaction_id ON payment(transaction_id);
CREATE INDEX idx_payment_gateway_status ON payment(gateway_status);
```

**Estimasi:** 1-2 hari

---

## Total Estimasi Refactoring

| Phase | Priority | Estimasi | Dependencies |
|-------|----------|----------|--------------|
| Phase 1: Extract Module | HIGH | 2-3 hari | - |
| Phase 2: Add Domain Layer | HIGH | 2-3 hari | Phase 1 |
| Phase 3: Add DTO & Validation | MEDIUM | 1-2 hari | Phase 2 |
| Phase 4: Refactor Services | MEDIUM | 3-4 hari | Phase 2, 3 |
| Phase 5: Add Missing Features | MEDIUM | 3-4 hari | Phase 4 |
| Phase 6: Add Tests | HIGH | 4-5 hari | Phase 4 |
| Phase 7: Security Hardening | HIGH | 1-2 hari | Phase 4 |
| Phase 8: Performance Optimization | LOW | 1-2 hari | Phase 4 |

**Total:** 17-25 hari kerja (3-5 minggu)

**Rekomendasi:** Kerjakan secara bertahap, prioritaskan Phase 1, 2, 6, 7 terlebih dahulu.

---

## Kesimpulan

Modul payment-gateway memerlukan refactoring penuh untuk sesuai dengan Clean Architecture. Prioritas utama:

1. ✅ **Extract ke module terpisah** - Pisahkan dari finance module
2. ✅ **Add domain layer** - Implement proper domain entities dan ports
3. ✅ **Add tests** - Minimum 70% coverage untuk business logic
4. ✅ **Security hardening** - Fix webhook verification dan add rate limiting

Setelah refactoring, modul ini akan:
- ✅ Lebih maintainable dan testable
- ✅ Lebih secure dengan proper validation
- ✅ Lebih performant dengan caching
- ✅ Lebih reliable dengan retry mechanism
- ✅ Sesuai dengan Clean Architecture principles

---

**Next Steps:**
1. Review laporan ini dengan team
2. Prioritaskan phase mana yang akan dikerjakan terlebih dahulu
3. Buat task breakdown untuk setiap phase
4. Mulai refactoring secara bertahap

---

*Report generated by Claude Sonnet 4.6*
