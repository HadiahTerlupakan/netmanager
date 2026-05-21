# Coupons Module Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified issues in the Coupons module — tenant isolation, missing CRUD routes, test enum fix, auth on verify endpoint, and discount value validation.

**Architecture:** Follows existing Clean Architecture pattern (domain → repository → service → API route). Tenant isolation added at repository layer with `tenantId` parameter passed from API routes via session context.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Zod, Vitest

---

## Context & Findings

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| 1 | Repository & API tidak filter by `tenantId` | 🔴 Critical | Add tenantId param to repository methods + pass from API routes |
| 2 | GET single coupon API route missing | 🔴 Critical | Add GET handler to `/api/coupons/[id]/route.ts` |
| 3 | UPDATE coupon API route missing | 🔴 Critical | Add PUT handler + service method + repository method |
| 4 | Test uses `"PERCENTAGE"` instead of `"PERCENT"` | 🟠 Medium | Fix enum value in test |
| 5 | Verify endpoint has `auth: false` | 🟠 Medium | Change to `auth: true` |
| 6 | Transaction safety (coupon + payment) | ✅ Already OK | `applyCouponUsageIfNeeded` runs inside `$transaction` block |

**Note:** Issue #6 (transaction safety) is already correctly handled — `createCustomerPaymentsForInvoices` wraps everything in a Prisma `$transaction`, including `applyCouponUsageIfNeeded`. No fix needed.

---

## File Structure

**Modified files:**
- `modules/coupons/domain/ports/ICouponRepository.ts` — add `update` method + tenantId params
- `modules/coupons/repositories/CouponRepository.ts` — add `update` impl + tenantId filtering
- `modules/coupons/services/CouponService.ts` — add `updateCoupon` method + tenantId params
- `modules/coupons/validators/couponSchemas.ts` — add `updateCouponSchema`
- `modules/coupons/index.ts` — export new schema
- `app/api/coupons/route.ts` — pass tenantId to service
- `app/api/coupons/[id]/route.ts` — add GET + PUT handlers, pass tenantId
- `app/api/coupons/verify/route.ts` — change `auth: false` to `auth: true`
- `tests/modules/coupons/CouponService.test.ts` — fix `"PERCENTAGE"` → `"PERCENT"`

---

### Task 1: Fix Test Enum Value

**Files:**
- Modify: `tests/modules/coupons/CouponService.test.ts:199`

- [ ] **Step 1: Fix the enum value**

Change line 199 from `"PERCENTAGE"` to `"PERCENT"`:

```typescript
// Line 198-199 in the test
discountType: "PERCENT",
discountValue: 20, // 20%
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/modules/coupons/CouponService.test.ts`
Expected: All tests PASS (the PERCENTAGE discount test should now calculate correctly)

- [ ] **Step 3: Commit**

```bash
git add tests/modules/coupons/CouponService.test.ts
git commit -m "fix(coupons): correct discount type enum in test from PERCENTAGE to PERCENT"
```

---

### Task 2: Add Tenant Isolation to Repository

**Files:**
- Modify: `modules/coupons/domain/ports/ICouponRepository.ts`
- Modify: `modules/coupons/repositories/CouponRepository.ts`

- [ ] **Step 1: Update ICouponRepository interface**

Add `tenantId` parameter to `findAll`, `findByCode`, `create`, and `delete`:

```typescript
// modules/coupons/domain/ports/ICouponRepository.ts

export interface ICouponRepository {
  findAll(params?: {
    skip?: number;
    take?: number;
    tenantId?: string | null;
  }): Promise<{ items: CouponEntity[]; total: number }>;

  findById(id: string): Promise<CouponEntity | null>;

  findByCode(code: string, tenantId?: string | null): Promise<CouponEntity | null>;

  create(data: CreateCouponInput & { tenantId?: string | null }): Promise<CouponEntity>;

  update(id: string, data: UpdateCouponInput): Promise<CouponEntity>;

  incrementUsage(id: string, tx?: unknown): Promise<CouponEntity>;

  recordUsage(
    couponId: string,
    pelangganId: string,
    tx?: unknown,
  ): Promise<CouponUsageEntity>;

  delete(id: string): Promise<void>;
}
```

Also add the import for `UpdateCouponInput`:

```typescript
import type { CreateCouponInput, UpdateCouponInput } from "../../dto/CouponDTO";
```

- [ ] **Step 2: Add UpdateCouponInput type to DTO**

Add to `modules/coupons/dto/CouponDTO.ts` after `CreateCouponInput`:

```typescript
/**
 * Input model for updating coupon in application layer.
 */
export interface UpdateCouponInput {
  description?: string;
  discountValue?: number;
  minTransaction?: number;
  maxDiscount?: number | null;
  quota?: number;
  isActive?: boolean;
  endDate?: Date;
}
```

- [ ] **Step 3: Update CouponRepository implementation**

Update `modules/coupons/repositories/CouponRepository.ts`:

```typescript
import type { CreateCouponInput, UpdateCouponInput } from "../dto/CouponDTO";

// Update findAll to accept tenantId
async findAll(params?: {
  skip?: number;
  take?: number;
  tenantId?: string | null;
}): Promise<{ items: CouponEntity[]; total: number }> {
  const where = this.buildTenantFilter(params?.tenantId);
  const query = this.buildPaginationQuery(params);
  const [items, total] = await Promise.all([
    this.db.coupon.findMany({ where, orderBy: { createdAt: "desc" }, ...query }),
    this.db.coupon.count({ where }),
  ]);

  return { items: items.map((item) => CouponMapper.toDomain(item)), total };
}

// Update findByCode to accept tenantId
async findByCode(code: string, tenantId?: string | null): Promise<CouponEntity | null> {
  const where: Record<string, unknown> = { code };
  if (tenantId) {
    where.tenantId = tenantId;
  }
  const coupon = await this.db.coupon.findFirst({ where });
  return coupon ? CouponMapper.toDomain(coupon) : null;
}

// Update create to include tenantId
async create(data: CreateCouponInput & { tenantId?: string | null }): Promise<CouponEntity> {
  const coupon = await this.db.coupon.create({
    data: {
      id: randomUUID(),
      ...data,
      tenantId: data.tenantId ?? null,
      updatedAt: new Date(),
    },
  });

  return CouponMapper.toDomain(coupon);
}

// Add update method
async update(id: string, data: UpdateCouponInput): Promise<CouponEntity> {
  const coupon = await this.db.coupon.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  return CouponMapper.toDomain(coupon);
}

// Add private helper
private buildTenantFilter(tenantId?: string | null) {
  if (!tenantId) return {};
  return { tenantId };
}
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "coupon" | head -20`
Expected: No type errors related to coupon module

- [ ] **Step 5: Commit**

```bash
git add modules/coupons/domain/ports/ICouponRepository.ts modules/coupons/repositories/CouponRepository.ts modules/coupons/dto/CouponDTO.ts
git commit -m "feat(coupons): add tenant isolation to repository layer"
```

---

### Task 3: Add Tenant Isolation & Update Method to Service

**Files:**
- Modify: `modules/coupons/services/CouponService.ts`

- [ ] **Step 1: Update CouponService methods to accept tenantId**

```typescript
import type {
  CouponDetailDTO,
  CouponListItemDTO,
  CreateCouponInput,
  UpdateCouponInput,
} from "../dto/CouponDTO";

// Update getAllCoupons
async getAllCoupons(tenantId?: string | null): Promise<{
  items: CouponListItemDTO[];
  total: number;
}> {
  const result = await this.repository.findAll({ tenantId });
  return { items: CouponMapper.toDTOList(result.items), total: result.total };
}

// Update createCoupon
async createCoupon(data: CreateCouponInput & { tenantId?: string | null }): Promise<CouponListItemDTO> {
  await this.ensureCouponCodeIsUnique(data.code, data.tenantId);
  const coupon = await this.repository.create(data);
  return CouponMapper.toDTO(coupon);
}

// Add updateCoupon method (after deleteCoupon)
async updateCoupon(id: string, data: UpdateCouponInput): Promise<CouponDetailDTO> {
  const existing = await this.repository.findById(id);
  if (!existing) {
    throw new Error(COUPON_NOT_FOUND_MESSAGE);
  }
  const updated = await this.repository.update(id, data);
  return CouponMapper.toDetailDTO(updated);
}

// Update verifyCoupon to pass tenantId
async verifyCoupon(
  code: string,
  amount: number,
  _pelangganId?: string,
  tenantId?: string | null,
): Promise<VerifyCouponResult> {
  if (!code) {
    return this.createInvalidResult(REQUIRED_CODE_MESSAGE, amount);
  }

  const coupon = await this.repository.findByCode(code.toUpperCase(), tenantId);
  if (!coupon) {
    return this.createInvalidResult(MISSING_COUPON_MESSAGE, amount);
  }

  return this.buildVerificationResult(coupon, amount);
}

// Update ensureCouponCodeIsUnique
private async ensureCouponCodeIsUnique(code: string, tenantId?: string | null): Promise<void> {
  const existingCoupon = await this.repository.findByCode(code, tenantId);
  if (existingCoupon) {
    throw new Error(INVALID_COUPON_CODE_MESSAGE);
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "coupon" | head -20`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add modules/coupons/services/CouponService.ts
git commit -m "feat(coupons): add updateCoupon method and tenant isolation to service"
```

---

### Task 4: Add Update Coupon Schema

**Files:**
- Modify: `modules/coupons/validators/couponSchemas.ts`
- Modify: `modules/coupons/index.ts`

- [ ] **Step 1: Add updateCouponSchema to validators**

Append to `modules/coupons/validators/couponSchemas.ts`:

```typescript
/**
 * Schema for coupon update payload.
 */
export const updateCouponSchema = z.object({
  description: z.string().trim().optional(),
  discountValue: z.coerce.number().positive().optional(),
  minTransaction: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().nonnegative().nullable().optional(),
  quota: z.coerce.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  endDate: z.coerce.date().optional(),
});
```

- [ ] **Step 2: Export from index.ts**

Update `modules/coupons/index.ts` to export the new schema:

```typescript
export {
  createCouponSchema,
  updateCouponSchema,
  verifyCouponSchema,
} from "./services/CouponValidationService";
```

- [ ] **Step 3: Update CouponValidationService to re-export**

Update `modules/coupons/services/CouponValidationService.ts` to include the new schema:

```typescript
export { createCouponSchema, updateCouponSchema, verifyCouponSchema } from "../validators/couponSchemas";
```

- [ ] **Step 4: Commit**

```bash
git add modules/coupons/validators/couponSchemas.ts modules/coupons/index.ts modules/coupons/services/CouponValidationService.ts
git commit -m "feat(coupons): add updateCouponSchema validator"
```

---

### Task 5: Update API Routes — Tenant Isolation + GET/PUT

**Files:**
- Modify: `app/api/coupons/route.ts`
- Modify: `app/api/coupons/[id]/route.ts`

- [ ] **Step 1: Update GET/POST in `/api/coupons/route.ts` to pass tenantId**

```typescript
import { ZodError } from "zod";

import { couponService, createCouponSchema } from "@/modules/coupons";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("coupon:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kupon",
    );
  }

  const tenantId = ctx.session!.user.tenantId ?? null;
  const result = await couponService.getAllCoupons(tenantId);
  return apiSuccess(result.items);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("coupon:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat kupon");
  }

  try {
    const payload = createCouponSchema.parse(await req.json());
    const tenantId = ctx.session!.user.tenantId ?? null;
    const coupon = await couponService.createCoupon({
      ...payload,
      code: payload.code.toUpperCase(),
      tenantId,
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Coupon",
      details: { id: coupon.id, code: coupon.code },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(coupon, {
      status: 201,
      message: "Kupon berhasil dibuat",
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(
        error.issues[0]?.message ?? "Input kupon tidak valid",
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Gagal membuat kupon";
    if (errorMessage === "Coupon code already exists") {
      return ApiErrors.conflict(
        "Kode kupon sudah digunakan, silakan gunakan kode lain",
      );
    }
    return ApiErrors.internalError(errorMessage);
  }
});
```

- [ ] **Step 2: Rewrite `/api/coupons/[id]/route.ts` with GET + PUT + DELETE**

```typescript
import { ZodError } from "zod";

import { couponService, updateCouponSchema } from "@/modules/coupons";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("coupon:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kupon",
    );
  }

  const { id } = ctx.params;
  const coupon = await couponService.getCouponById(id);

  if (!coupon) {
    return ApiErrors.notFound("Kupon");
  }

  return apiSuccess(coupon);
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("coupon:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah kupon",
    );
  }

  const { id } = ctx.params;

  try {
    const payload = updateCouponSchema.parse(await req.json());
    const coupon = await couponService.updateCoupon(id, payload);

    await logger.logActivity({
      action: "UPDATE",
      subject: "Coupon",
      details: { id, changes: Object.keys(payload) },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(coupon, { message: "Kupon berhasil diperbarui" });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(
        error.issues[0]?.message ?? "Input kupon tidak valid",
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Gagal mengubah kupon";
    if (errorMessage === "Coupon not found") {
      return ApiErrors.notFound("Kupon");
    }
    return ApiErrors.internalError(errorMessage);
  }
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("coupon:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus kupon",
    );
  }

  const { id } = ctx.params;

  try {
    await couponService.deleteCoupon(id);

    await logger.logActivity({
      action: "DELETE",
      subject: "Coupon",
      details: { id },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(null, { message: "Kupon berhasil dihapus" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Gagal menghapus kupon";
    if (errorMessage === "Coupon not found") {
      return ApiErrors.notFound("Kupon");
    }
    if (errorMessage.includes("has been used")) {
      return apiError(
        "Kupon tidak bisa dihapus karena sudah pernah digunakan",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    return ApiErrors.internalError(errorMessage);
  }
});
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "coupon\|api/coupons" | head -20`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add app/api/coupons/route.ts app/api/coupons/[id]/route.ts
git commit -m "feat(coupons): add GET single, PUT update routes with tenant isolation"
```

---

### Task 6: Fix Verify Endpoint Auth

**Files:**
- Modify: `app/api/coupons/verify/route.ts`

- [ ] **Step 1: Change auth to true and pass tenantId**

```typescript
import { logger } from "@/lib/logger";
import { ZodError } from "zod";

import { couponService, verifyCouponSchema } from "@/modules/coupons";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  try {
    const payload = verifyCouponSchema.parse(await req.json());
    const tenantId = ctx.session!.user.tenantId ?? null;
    const result = await couponService.verifyCoupon(
      payload.code,
      payload.amount,
      payload.pelangganId,
      tenantId,
    );

    if (!result.valid) {
      return ApiErrors.badRequest(result.error || "Kupon tidak valid");
    }

    return apiSuccess({
      valid: true,
      code: payload.code.toUpperCase(),
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      couponId: result.couponId,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(
        error.issues[0]?.message ?? "Input verifikasi kupon tidak valid",
      );
    }

    logger.error("Coupon verify error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal memverifikasi kupon";
    return ApiErrors.internalError(message);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/coupons/verify/route.ts
git commit -m "fix(coupons): require auth on verify endpoint to prevent enumeration"
```

---

### Task 7: Update CustomerPaymentRouteService to Pass TenantId

**Files:**
- Modify: `modules/pelanggan/services/CustomerPaymentRouteService.ts`

- [ ] **Step 1: Pass tenantId to coupon verification**

Update the `resolveCoupon` function:

```typescript
async function resolveCoupon(input: CustomerPaymentInput, totalAmount: number) {
  if (!input.couponCode) {
    return { discountAmount: 0, couponId: null as string | null };
  }

  const verification = await couponService.verifyCoupon(
    input.couponCode,
    totalAmount,
    input.customerId,
    input.tenantId,
  );

  if (!verification.valid) {
    throw new Error(verification.error || "Kupon tidak valid");
  }

  return {
    discountAmount: verification.discountAmount,
    couponId: verification.couponId,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "coupon\|CustomerPayment" | head -20`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add modules/pelanggan/services/CustomerPaymentRouteService.ts
git commit -m "fix(coupons): pass tenantId to coupon verification in payment flow"
```

---

### Task 8: Run Full Verification

- [ ] **Step 1: Run coupon tests**

Run: `npx vitest run tests/modules/coupons/`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npx eslint modules/coupons/ app/api/coupons/ --ext .ts,.tsx`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Run full check**

Run: `npm run check`
Expected: PASS (lint + typecheck + build)

---

## Summary of Changes

| File | Change |
|------|--------|
| `tests/modules/coupons/CouponService.test.ts` | Fix `"PERCENTAGE"` → `"PERCENT"` |
| `modules/coupons/domain/ports/ICouponRepository.ts` | Add `update` method, tenantId params |
| `modules/coupons/dto/CouponDTO.ts` | Add `UpdateCouponInput` interface |
| `modules/coupons/repositories/CouponRepository.ts` | Add `update`, tenant filtering |
| `modules/coupons/services/CouponService.ts` | Add `updateCoupon`, tenantId params |
| `modules/coupons/validators/couponSchemas.ts` | Add `updateCouponSchema` |
| `modules/coupons/services/CouponValidationService.ts` | Re-export new schema |
| `modules/coupons/index.ts` | Export `updateCouponSchema` |
| `app/api/coupons/route.ts` | Pass tenantId to service |
| `app/api/coupons/[id]/route.ts` | Add GET + PUT handlers |
| `app/api/coupons/verify/route.ts` | Change `auth: false` → `auth: true`, pass tenantId |
| `modules/pelanggan/services/CustomerPaymentRouteService.ts` | Pass tenantId to verify |
