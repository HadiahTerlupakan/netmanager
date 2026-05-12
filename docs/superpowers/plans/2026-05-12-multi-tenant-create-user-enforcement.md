# Multi-Tenant Create User Tenant Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memastikan create user selalu tenant-safe: superadmin tetap bisa memilih tenant secara eksplisit, sementara non-superadmin selalu membuat user di tenant session miliknya tanpa bisa override lewat payload.

**Architecture:** Tenant assignment dipusatkan di service layer `AdminUserRouteCreateService` agar intent bisnis eksplisit dan mudah dites. UI `UsersNewClient` hanya menampilkan tenant selector untuk user yang memang boleh memilih tenant, lalu submit payload non-superadmin tidak lagi membawa kontrak palsu bahwa client menentukan tenant. Prisma extension tetap menjadi defense-in-depth dan tidak diubah pada pass pertama kecuali verifikasi akhir membuktikan ada celah.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest, React Testing Library/jsdom-style DOM testing, Prisma tenant isolation.

---

## File Map

- **Modify:** `modules/users/services/admin-user-route.create.ts`
  - Sumber kebenaran tenant assignment saat create user.
  - Menentukan `targetTenantId` final untuk superadmin vs non-superadmin.
  - Menjamin fail-closed bila non-superadmin tidak punya `session.user.tenantId`.

- **Create:** `tests/modules/users/services/AdminUserRouteCreateService.test.ts`
  - Regression test level service untuk rule tenant assignment.
  - Memastikan payload tenant non-superadmin diabaikan.
  - Memastikan flow superadmin tetap eksplisit.

- **Modify:** `app/admin/users/new/UsersNewClient.tsx`
  - Sinkronisasi kontrak UI: query param tenant hanya relevan untuk user yang boleh memilih tenant.
  - Submit payload non-superadmin tidak mengirim `tenantId`.
  - Tenant picker hanya kontrak superadmin / tenant-readable user.

- **Modify:** `tests/app/admin-users-new-client-reference-data.test.tsx`
  - Regression test UI ringan untuk memastikan non-superadmin tidak bergantung pada tenant picker atau tenant query prefill.

- **Verify only (no planned code edit on first pass):** `lib/prisma-extension.ts`
  - Sudah menghapus `tenantId`/`tenant` dari create non-superadmin dan meng-inject tenant context.
  - Dipertahankan sebagai defense-in-depth; hanya disentuh jika verification task membuktikan gap nyata.

---

### Task 1: Kunci tenant assignment di service create user

**Files:**
- Create: `tests/modules/users/services/AdminUserRouteCreateService.test.ts`
- Modify: `modules/users/services/admin-user-route.create.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUserRouteCreateService } from "@/modules/users/services/admin-user-route.create";
import { UserService } from "@/modules/users/services/UserService";

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: () => ({
    isRestricted: false,
    siteIds: [],
    primarySiteId: null,
  }),
}));

describe("AdminUserRouteCreateService.createUser tenant enforcement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("memaksa tenant session untuk non-superadmin walau payload membawa tenant lain", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1", tenantId: "tenant-session" } as never);

    const service = new AdminUserRouteCreateService({} as never);

    await service.createUser(
      {
        user: {
          id: "creator-1",
          isSuperAdmin: false,
          tenantId: "tenant-session",
        },
      } as never,
      {
        email: "staff@tenant.test",
        password: "Secret123!",
        roleId: "role-1",
        tenantId: "tenant-other",
      },
    );

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-session",
      }),
    );
  });

  it("gagal tertutup bila non-superadmin tidak punya tenant session", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1" } as never);

    const service = new AdminUserRouteCreateService({} as never);

    await expect(
      service.createUser(
        {
          user: {
            id: "creator-1",
            isSuperAdmin: false,
            tenantId: null,
          },
        } as never,
        {
          email: "staff@tenant.test",
          password: "Secret123!",
          roleId: "role-1",
        },
      ),
    ).rejects.toThrow("Tenant context wajib tersedia");

    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("tetap memakai tenant payload untuk superadmin", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1", tenantId: "tenant-target" } as never);

    const service = new AdminUserRouteCreateService({} as never);

    await service.createUser(
      {
        user: {
          id: "superadmin-1",
          isSuperAdmin: true,
          tenantId: null,
        },
      } as never,
      {
        email: "admin@tenant.test",
        password: "Secret123!",
        roleId: "role-1",
        tenantId: "tenant-target",
      },
    );

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-target",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/modules/users/services/AdminUserRouteCreateService.test.ts
```

Expected:
- Test pertama gagal karena `tenantId` yang diteruskan masih bisa berasal dari `payload.tenantId`.
- Test kedua gagal karena service belum fail-closed saat `session.user.tenantId` kosong.

- [ ] **Step 3: Write minimal implementation**

Di `modules/users/services/admin-user-route.create.ts`, tambahkan resolver tenant yang eksplisit dan pakai nilainya di `buildCreationContext()` serta `createUserEntityWithSites()`.

```ts
private resolveTargetTenantId(
  session: AdminSession,
  payload: CreateAdminUserInput,
) {
  if (session.user.isSuperAdmin) {
    return payload.tenantId ?? undefined;
  }

  const sessionTenantId = session.user.tenantId ?? null;

  if (!sessionTenantId) {
    throw new Error("Tenant context wajib tersedia untuk membuat user.");
  }

  return sessionTenantId;
}

private async buildCreationContext(
  session: AdminSession,
  payload: CreateAdminUserInput,
) {
  const targetTenantId = this.resolveTargetTenantId(session, payload);
  const effectiveRoleId = await this.resolveRoleId(
    payload.roleId,
    targetTenantId,
  );

  return {
    targetTenantId,
    effectiveRoleId,
    flexibleTargetHour:
      payload.flexibleTargetHour ?? DEFAULT_FLEXIBLE_TARGET_HOUR,
  };
}

private async createUserEntityWithSites(
  payload: CreateAdminUserInput,
  context: {
    targetTenantId?: string;
    effectiveRoleId?: string;
    flexibleTargetHour: number;
  },
  userSites: Array<{ siteId: string; isPrimary?: boolean }>,
) {
  const userService = new UserService(this.userRepository);

  const userData = {
    ...payload,
    roleId: context.effectiveRoleId || payload.roleId,
    tenantId: context.targetTenantId ?? null,
    flexibleTargetHour: context.flexibleTargetHour,
  };

  if (userSites.length > 0) {
    return userService.createUserWithSites(userData, userSites);
  }

  return userService.createUser(userData);
}
```

Catatan implementasi:
- Jangan lagi gunakan `payload.tenantId` langsung di jalur non-superadmin.
- Dengan resolver ini, fallback role tenant juga otomatis tetap bekerja karena `resolveRoleId()` sekarang menerima tenant session untuk non-superadmin.
- Jangan ubah `lib/prisma-extension.ts` pada task ini.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/modules/users/services/AdminUserRouteCreateService.test.ts
```

Expected:
- Semua test pass.
- Bukti utama: non-superadmin selalu meneruskan `tenantId` session, bukan `payload`.

- [ ] **Step 5: Prepare commit command (jangan jalankan kecuali user meminta commit)**

```bash
git add tests/modules/users/services/AdminUserRouteCreateService.test.ts modules/users/services/admin-user-route.create.ts
git commit -m "fix(users): enforce tenant session on admin create user"
```

---

### Task 2: Sinkronkan kontrak UI create-user untuk non-superadmin

**Files:**
- Modify: `app/admin/users/new/UsersNewClient.tsx`
- Modify: `tests/app/admin-users-new-client-reference-data.test.tsx`

- [ ] **Step 1: Write the failing UI regression test**

Tambahkan test baru ke `tests/app/admin-users-new-client-reference-data.test.tsx`:

```tsx
it("mengabaikan tenant query param untuk user tanpa akses tenants:read", async () => {
  mockFns.hasPermission.mockImplementation((permission: string) => {
    return permission === "users:create";
  });

  mockFns.searchGet.mockImplementation((key: string) => {
    return key === "tenantId" ? "tenant-from-query" : null;
  });

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/roles?filterRestricted=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "role-1", name: "Admin" }],
        } as Response);
      }

      if (url.includes("/api/admin/departments")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: "dep-1", name: "Ops" }] }),
        } as Response);
      }

      if (url.includes("/api/admin/sites?activeOnly=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: "site-1", code: "HQ", name: "Site A" }],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    }),
  );

  const { ClientComponent } = await import(
    "@/app/admin/users/new/UsersNewClient"
  );

  await act(async () => {
    createRoot(container).render(<ClientComponent />);
    await flushPromises();
    await flushPromises();
  });

  const tenantSelect = container.querySelector(
    'select[name="tenantId"]',
  ) as HTMLSelectElement | null;

  expect(tenantSelect).toBeNull();
});
```

Jika submit payload di file ini mudah dijangkau tanpa menambah setup besar, tambahkan satu assertion lagi di test terpisah:
- POST `/api/admin/users` untuk non-superadmin tidak mengirim `tenantId` di body.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/app/admin-users-new-client-reference-data.test.tsx -t "mengabaikan tenant query param untuk user tanpa akses tenants:read"
```

Expected:
- Test gagal bila komponen masih membaca `tenantId` query param tanpa membedakan hak pilih tenant.
- At minimum, failure menunjukkan kontrak UI belum tegas dipisah untuk non-superadmin.

- [ ] **Step 3: Write minimal implementation**

Di `app/admin/users/new/UsersNewClient.tsx`, lakukan tiga perubahan kecil dan eksplisit:

1. Gate query param tenant agar hanya relevan untuk user yang memang boleh memilih tenant.
2. Submit payload non-superadmin tanpa `tenantId`.
3. Biarkan validasi tenant tetap hanya berlaku untuk user yang bisa memilih tenant.

Potongan perubahan yang dituju:

```ts
const canCreate = hasPermission("users:create");
const canReadTenants = hasPermission("tenants:read");
const tenantIdParam = canReadTenants ? searchParams.get("tenantId") : null;
```

```ts
useEffect(() => {
  if (!tenantIdParam) {
    return;
  }

  setFormData((prev) => ({
    ...prev,
    tenantId: tenantIdParam,
  }));
}, [tenantIdParam]);
```

```ts
const payload = {
  ...formData,
  tenantId: canReadTenants ? formData.tenantId : undefined,
};

await fetch("/api/admin/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

Tetap pertahankan:
```ts
if (canReadTenants && !formData.tenantId) {
  newErrors.tenantId = "Tenant wajib dipilih";
}
```

Intent hasil akhir:
- superadmin / tenant-readable user tetap punya explicit picker,
- non-superadmin tidak lagi diprefill atau disubmit seolah memilih tenant sendiri.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/app/admin-users-new-client-reference-data.test.tsx
```

Expected:
- Test lama reference-data tetap hijau.
- Test baru membuktikan tenant query param tidak lagi memengaruhi kontrak non-superadmin.

- [ ] **Step 5: Prepare commit command (jangan jalankan kecuali user meminta commit)**

```bash
git add app/admin/users/new/UsersNewClient.tsx tests/app/admin-users-new-client-reference-data.test.tsx
git commit -m "fix(users): align create user client with tenant-safe contract"
```

---

### Task 3: Verifikasi defense-in-depth dan regression akhir

**Files:**
- Verify: `lib/prisma-extension.ts`
- Verify: `tests/api/admin-users-route.test.ts`
- Verify: `tests/app/admin-users-new-client-reference-data.test.tsx`
- Verify: `tests/modules/users/services/AdminUserRouteCreateService.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run:
```bash
npx vitest run tests/modules/users/services/AdminUserRouteCreateService.test.ts tests/app/admin-users-new-client-reference-data.test.tsx tests/api/admin-users-route.test.ts
```

Expected:
- Service regression pass.
- UI regression pass.
- Existing route test tetap pass sehingga controller contract tidak rusak.

- [ ] **Step 2: Run typecheck to catch shape drift**

Run:
```bash
npm run typecheck
```

Expected:
- Tidak ada type error baru dari `session.user.tenantId`, `CreateAdminUserInput`, atau payload submit.

- [ ] **Step 3: Only if verification reveals a real gap, tighten Prisma defense-in-depth minimally**

Jika dan hanya jika test/trace menunjukkan create flow tertentu masih lolos tanpa tenant walau service sudah benar, baru lakukan perubahan minimal di `lib/prisma-extension.ts`. Target perubahan harus sekecil ini:

```ts
if (operation === "create") {
  args.data = applyTenantToCreateData(
    args.data as Record<string, unknown> | undefined,
    tenantId,
  );
}
```

Aturan task ini:
- Jangan refactor besar extension.
- Jangan ubah kontrak superadmin.
- Jangan sentuh file ini bila suite sudah hijau.

- [ ] **Step 4: Re-run the same regression suite after any defensive change**

Run:
```bash
npx vitest run tests/modules/users/services/AdminUserRouteCreateService.test.ts tests/app/admin-users-new-client-reference-data.test.tsx tests/api/admin-users-route.test.ts
npm run typecheck
```

Expected:
- Semua tetap hijau.
- Tidak ada perubahan perilaku superadmin.

- [ ] **Step 5: Prepare final commit command (jangan jalankan kecuali user meminta commit)**

```bash
git add modules/users/services/admin-user-route.create.ts app/admin/users/new/UsersNewClient.tsx tests/modules/users/services/AdminUserRouteCreateService.test.ts tests/app/admin-users-new-client-reference-data.test.tsx
git commit -m "fix(users): enforce tenant-safe admin user creation"
```

---

## Review Checklist

- [ ] Non-superadmin create user selalu memakai `session.user.tenantId`
- [ ] Non-superadmin payload `tenantId` tidak lagi memengaruhi hasil create
- [ ] Non-superadmin tanpa tenant session gagal tertutup
- [ ] Superadmin tetap bisa create user untuk tenant yang dipilih
- [ ] UI tidak lagi memperlakukan tenant sebagai field milik non-superadmin
- [ ] Prisma extension tetap menjadi pagar terakhir tanpa perubahan besar yang tidak perlu

## Recommended Execution Mode

[Asumsi: eksekusi berikutnya memakai **Subagent-Driven** karena Task 1 dan Task 2 bisa dijalankan independen dengan review ketat di antara siklus TDD, lalu Task 3 menjadi gate verifikasi akhir.]
