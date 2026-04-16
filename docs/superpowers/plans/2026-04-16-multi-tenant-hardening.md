# Multi-Tenant Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup gap multi-tenant paling material dengan menyelaraskan wrapper backend, memperjelas inventory domain guard, dan mengurangi false sense of safety pada guard mobile.

**Architecture:** Prisma extension tetap menjadi enforcement tenant utama, tetapi route wrapper dan domain service diperkeras agar tenant/site/gudang scoping tidak bergantung pada asumsi implisit. Hardening dilakukan kecil dan terfokus: parity wrapper backend, explicit domain guard inventory, lalu klarifikasi boundary mobile UX guard.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, Expo/React Native.

---

### Task 1: Samakan `secure()` dengan request tenant binding `createHandler`

**Files:**
- Modify: `lib/api/secure-handler.ts`
- Test: `tests/lib/secure-handler-tenant-context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockVerifyAuth = vi.fn()
const mockGetUserPermissions = vi.fn()
const mockRunWithRequestTenantContext = vi.fn()

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  isSuperAdmin: (user: { role?: string; isSuperAdmin?: boolean }) =>
    user.isSuperAdmin ?? user.role === 'SUPER_ADMIN',
  getUserPermissions: (...args: unknown[]) => mockGetUserPermissions(...args),
}))

vi.mock('@/lib/tenant-context', () => ({
  runWithRequestTenantContext: (...args: unknown[]) =>
    mockRunWithRequestTenantContext(...args),
}))

import { secure } from '@/lib/api/secure-handler'

describe('secure tenant context binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      permissions: [],
      isSuperAdmin: false,
    })
    mockGetUserPermissions.mockResolvedValue(['inventory:read'])
    mockRunWithRequestTenantContext.mockImplementation(
      async (_ctx, callback: () => Promise<Response>) => callback(),
    )
  })

  it('membungkus handler dengan request tenant context', async () => {
    const route = secure(async () => NextResponse.json({ ok: true }))

    const response = await route(
      new NextRequest('http://localhost/api/test'),
      { params: Promise.resolve({}) },
    )

    expect(response.status).toBe(200)
    expect(mockRunWithRequestTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', isSuperAdmin: false },
      expect.any(Function),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/secure-handler-tenant-context.test.ts`
Expected: FAIL karena `runWithRequestTenantContext` belum dipanggil dari `secure()`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { runWithRequestTenantContext } from '@/lib/tenant-context'

// ...inside secure()
return await runWithRequestTenantContext(
  {
    tenantId: user.tenantId ?? null,
    isSuperAdmin: isSuper,
  },
  async () => handler(req, { ...context, params: resolvedParams }),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/secure-handler-tenant-context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/lib/secure-handler-tenant-context.test.ts lib/api/secure-handler.ts
git commit -m "fix: bind tenant context in secure handler"
```

### Task 2: Tambahkan guard eksplisit untuk inventory opname domain

**Files:**
- Modify: `modules/inventory/services/InventoryOpnameService.ts`
- Modify: `modules/inventory/utils/validation.ts`
- Test: `tests/modules/inventory/InventoryOpnameService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockValidateGudangAccess = vi.fn()
const mockPrisma = {
  barang: { findUnique: vi.fn() },
  gudang: { findUnique: vi.fn() },
  barangGudang: { findUnique: vi.fn() },
  stockOpname: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  barangMasuk: { create: vi.fn() },
  barangKeluar: { create: vi.fn() },
  $transaction: vi.fn(),
  user: { findUnique: vi.fn() },
}

vi.mock('@/modules/database', () => ({ prisma: mockPrisma }))
vi.mock('../utils/validation', () => ({
  validateGudangAccess: (...args: unknown[]) => mockValidateGudangAccess(...args),
}))

import { InventoryOpnameService } from '@/modules/inventory/services/InventoryOpnameService'

describe('InventoryOpnameService hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateGudangAccess.mockResolvedValue({
      allowed: true,
      gudang: { id: 'gudang-1', tenantId: 'tenant-1', sites: [{ id: 'site-1' }] },
    })
  })

  it('menolak create opname saat barang berasal dari tenant berbeda', async () => {
    const service = new InventoryOpnameService()

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
      mockPrisma.barang.findUnique.mockResolvedValue({ id: 'barang-1', tenantId: 'tenant-2' })
      mockPrisma.gudang.findUnique.mockResolvedValue({ id: 'gudang-1', tenantId: 'tenant-1', isActive: true })
      mockPrisma.barangGudang.findUnique.mockResolvedValue({ barangId: 'barang-1', gudangId: 'gudang-1', stok: 2, tenantId: 'tenant-1' })
      return callback(mockPrisma as never)
    })

    await expect(
      service.createOpname({
        user: { id: 'user-1', role: 'ADMIN', siteId: 'site-1' },
        barangId: 'barang-1',
        gudangId: 'gudang-1',
        stokFisik: 3,
      }),
    ).rejects.toThrow('Barang tidak berada dalam tenant yang sama dengan gudang tujuan')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/inventory/InventoryOpnameService.test.ts`
Expected: FAIL karena service belum punya explicit tenant consistency check.

- [ ] **Step 3: Write minimal implementation**

```ts
type GudangAccessResult = {
  allowed: boolean
  error?: string
  gudang?: { id: string; tenantId: string | null; sites: Array<{ id: string }> }
}

function ensureTenantConsistency(
  barangTenantId: string | null | undefined,
  gudangTenantId: string | null | undefined,
  stockTenantId: string | null | undefined,
) {
  if (barangTenantId !== gudangTenantId) {
    throw new Error('Barang tidak berada dalam tenant yang sama dengan gudang tujuan')
  }

  if (stockTenantId !== undefined && stockTenantId !== null && stockTenantId !== gudangTenantId) {
    throw new Error('Stok gudang tidak berada dalam tenant yang sama dengan gudang tujuan')
  }
}
```

Dan panggil helper ini di `createOpname()` serta gunakan `gudang` hasil `validateGudangAccess()` sebagai sumber domain object tepercaya.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/modules/inventory/InventoryOpnameService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/modules/inventory/InventoryOpnameService.test.ts modules/inventory/services/InventoryOpnameService.ts modules/inventory/utils/validation.ts
git commit -m "fix: harden inventory opname tenant validation"
```

### Task 3: Perjelas kontrak helper akses gudang

**Files:**
- Modify: `modules/inventory/utils/validation.ts`
- Test: `tests/modules/inventory/validateGudangAccess.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from 'next-auth'

const mockGudangFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    gudang: { findUnique: (...args: unknown[]) => mockGudangFindUnique(...args) },
  },
}))

import { validateGudangAccess } from '@/modules/inventory/utils/validation'

describe('validateGudangAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mengembalikan gudang agar caller dapat menegakkan tenant consistency eksplisit', async () => {
    mockGudangFindUnique.mockResolvedValue({
      id: 'gudang-1',
      tenantId: 'tenant-1',
      sites: [{ id: 'site-1' }],
    })

    const result = await validateGudangAccess(
      {
        user: {
          role: 'ADMIN',
          siteId: 'site-1',
          permissions: ['k_barang:site_only'],
        },
      } as Session,
      'gudang-1',
    )

    expect(result).toEqual({
      allowed: true,
      gudang: {
        id: 'gudang-1',
        tenantId: 'tenant-1',
        sites: [{ id: 'site-1' }],
      },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/inventory/validateGudangAccess.test.ts`
Expected: FAIL karena helper belum mengembalikan objek gudang.

- [ ] **Step 3: Write minimal implementation**

```ts
type GudangAccessResult = {
  allowed: boolean
  error?: string
  gudang?: {
    id: string
    tenantId: string | null
    sites: Array<{ id: string }>
  }
}

return {
  allowed: true,
  gudang: {
    id: gudang.id,
    tenantId: gudang.tenantId,
    sites: gudang.sites.map((site) => ({ id: site.id })),
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/modules/inventory/validateGudangAccess.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/modules/inventory/validateGudangAccess.test.ts modules/inventory/utils/validation.ts
git commit -m "refactor: return gudang context from inventory access validation"
```

### Task 4: Dokumentasikan bahwa mobile guard adalah UX layer

**Files:**
- Modify: `../mobile-netmanager/src/hooks/useFeatureGuard.ts`
- Modify: `../mobile-netmanager/src/components/atoms/Can.tsx`
- Modify: `docs/security/MULTI_TENANT_SOURCE_OF_TRUTH.md`

- [ ] **Step 1: Write the failing test**

Tidak ada test behavior baru untuk mobile guard pada task ini. Ini task dokumentasi/clarity; jangan ubah behavior route mobile pada batch ini.

- [ ] **Step 2: Add explicit non-security-boundary comments**

```ts
/**
 * UX-only feature guard.
 * Do not treat this hook as a security boundary.
 * Backend API authorization and tenant isolation remain the source of truth.
 */
```

Tambahkan komentar setara di `Can.tsx`.

- [ ] **Step 3: Verify no runtime behavior changes**

Run: `npm test -- tests/lib/api-handler-mobile-auth.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add ../mobile-netmanager/src/hooks/useFeatureGuard.ts ../mobile-netmanager/src/components/atoms/Can.tsx docs/security/MULTI_TENANT_SOURCE_OF_TRUTH.md
git commit -m "docs: clarify mobile guards as ux-only layer"
```

### Task 5: Final verification

**Files:**
- Test only

- [ ] **Step 1: Run targeted tests**

Run:
```bash
npm test -- tests/lib/secure-handler-tenant-context.test.ts tests/modules/inventory/InventoryOpnameService.test.ts tests/modules/inventory/validateGudangAccess.test.ts tests/lib/api-handler-mobile-auth.test.ts tests/lib/prisma-extension-tenant-context-alias.test.ts
```

Expected: all PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 3: Run lint pada file yang berubah jika perlu**

Run: `npm run lint`
Expected: exit code 0

- [ ] **Step 4: Commit final verification fixes jika ada**

```bash
git add <files-fixed-during-verification>
git commit -m "chore: finalize multi-tenant hardening verification"
```
