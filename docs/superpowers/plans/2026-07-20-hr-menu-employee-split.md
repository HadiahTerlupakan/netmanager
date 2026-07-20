# HR Menu — Pisah Kepegawaian dari Karyawan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah menu admin **HR** yang menampung data kepegawaian (departemen, multi-site, jam kerja, kuota cuti) yang dipisah dari form menu **Pengguna** (`/admin/users`), tanpa migration Prisma dan tanpa memindah menu Kehadiran/Penggajian.

**Architecture:** Surface UI baru di `app/admin/hr/**` mereuse API existing (`/api/admin/users`, `/api/admin/leave-balance`) dan komponen form yang diextract ke `app/admin/hr/_components/`. Menu `HR` / `HR.EMPLOYEES` di-map permission ke `users` via specialMappings. Form edit Pengguna hanya IAM + sales; create user tetap boleh set dept/site onboarding.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, existing `lib/menu-config.ts` + `lib/rbac.ts` + `modules/users` DTO

**Spec SOT:** [`docs/specifications/PRD-HR-MENU-SPLIT-2026-07-20.md`](../../specifications/PRD-HR-MENU-SPLIT-2026-07-20.md) (v2)

## Global Constraints

- Bahasa UI & response agent: **Bahasa Indonesia** (kecuali user minta lain).
- **Tidak** ubah `prisma/schema.prisma` / buat migration.
- **Tidak** pecah entity `User` → `Employee`.
- **Tidak** pindah top-level Kehadiran / Penggajian ke bawah HR.
- **Tidak** permission resource baru `hr:*` di fase ini — reuse `users:read` / `users:update` (+ leave existing jika sudah dipakai).
- Code menu child **wajib** special-mapped: `"HR"` → `"users"`, `"HR.EMPLOYEES"` → `"users"`.
- Parent `HR` **tanpa** `featureModule`; child `HR.EMPLOYEES` pakai `featureModule: "users"`.
- Path IAM tetap: `/admin/users`, `/admin/users/[id]`, `/admin/users/new`.
- Path HR baru: `/admin/hr`, `/admin/hr/employees`, `/admin/hr/employees/[id]`.
- Sales flags **tetap** di form Pengguna.
- Create user: **tetap** boleh dept/site; **hapus** jam kerja + kuota cuti dari create (pindah ke HR setelah user ada).
- Edit user Pengguna: **hapus** dept/site + jam kerja + kuota cuti dari form; ganti CTA ke HR.
- SOT implementasi: update `docs/CHANGELOG.md` `[Unreleased]` **setelah** fase selesai.
- **Git commit / push: DILARANG** sampai user minta eksplisit. Setiap task step “Commit” diganti **verifikasi + jangan commit**.
- Ikuti Clean Architecture: page thin, no Prisma di UI, no business logic baru di `app/api`.
- Minimal impact: extract shared components, jangan rewrite `modules/users`.

---

## File map

### Create

| File | Responsibility |
|------|----------------|
| `app/admin/hr/page.tsx` | Landing card hub HR (server, `ensurePermission('users:read')`) |
| `app/admin/hr/employees/page.tsx` | Server shell list + `ensurePermission('users:read')` |
| `app/admin/hr/employees/HrEmployeesListClient.tsx` | Client list pegawai (kolom HR-oriented) |
| `app/admin/hr/employees/[id]/page.tsx` | Server shell detail + `ensurePermission('users:read')` |
| `app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx` | Client edit kepegawaian only |
| `app/admin/hr/_components/OrganizationSection.tsx` | Extract dari users form (dept + multi-site) |
| `app/admin/hr/_components/WorkingHoursSettings.tsx` | Extract/move dari `app/admin/users/[id]/WorkingHoursSettings.tsx` |
| `app/admin/hr/_components/LeaveBalanceSettings.tsx` | Extract/move dari `app/admin/users/[id]/LeaveBalanceSettings.tsx` |
| `app/admin/hr/_components/MultiSiteSelect.tsx` | Extract dari `app/admin/users/components/MultiSiteSelect.tsx` **atau** re-export dari path shared |
| `app/admin/hr/lib/hrEmployeeApi.ts` | Thin re-export / wrapper ke fetch user + save leave (boleh import dari `app/admin/users/lib/userDetailApi`) |
| `app/admin/hr/lib/siteHelpers.ts` | Copy atau re-export `normalizeSelectedSites`, `getSelectedSitesFromUser`, dll. dari `user-detail-helpers` |
| `tests/admin/hr-menu-config.test.ts` | Contract: menu HR + special mapping permission |
| `tests/admin/hr-employees-surface.test.ts` | Contract: path files exist + users form no longer mounts HR sections on edit |

### Modify

| File | Change |
|------|--------|
| `lib/menu-config.ts` (~L386–393) | Rename display `USERS` → `Pengguna`; insert block `HR` + child |
| `components/layout/admin-sidebar/adminSidebarMenu.ts` (~L210–249) | specialMappings `HR`, `HR.EMPLOYEES` → `users` |
| `app/admin/users/components/UserFormSections.tsx` | Re-export OrganizationSection dari HR path **atau** thin wrapper import HR (hindari duplikasi) |
| `app/admin/users/[id]/UsersDetailClient.tsx` | Cabut Organization/WorkingHours/LeaveBalance; strip fields dari updateBody; CTA ke HR |
| `app/admin/users/[id]/UsersDetailView.tsx` | Working hours / leave ringkas → CTA link HR; dept/site boleh read-only + link |
| `app/admin/users/new/UsersNewClient.tsx` | Hapus WorkingHours + LeaveBalance; **pertahankan** OrganizationSection |
| `app/admin/users/[id]/WorkingHoursSettings.tsx` | Jadi re-export dari `app/admin/hr/_components/WorkingHoursSettings` (backward compat create/new jika masih import) **atau** update semua import |
| `app/admin/users/[id]/LeaveBalanceSettings.tsx` | Sama: re-export dari HR |
| `docs/CHANGELOG.md` | Entry `[ADDED]` + `[CHANGED]` setelah implementasi |
| `docs/guides/menu-configuration.md` | Cuplikan singkat menu HR (opsional, jika menyebut Karyawan) |
| `docs/specifications/PRD-HR-MENU-SPLIT-2026-07-20.md` | Status → Implemented (Fase 1) setelah selesai |

### Do not touch

- `prisma/**`
- `app/admin/kehadiran/**`, `app/admin/salary/**`, `app/admin/lembur/**`, `app/admin/attendance/**` (kecuali link di landing)
- `modules/users` business logic (kecuali bug blocker)
- Seed permission massal

### Dependency order

```
Task 1 (permission map + menu + tests)
  → Task 2 (extract shared HR components)
    → Task 3 (HR list page)
      → Task 4 (HR detail page)
        → Task 5 (strip users edit + new + view CTA)
          → Task 6 (landing /admin/hr)
            → Task 7 (changelog + PRD status + manual QA checklist)
```

---

### Task 1: Menu HR + permission special mapping

**Files:**
- Modify: `lib/menu-config.ts` (blok SDM ~L383–393)
- Modify: `components/layout/admin-sidebar/adminSidebarMenu.ts` (`specialMappings` ~L210–249)
- Create: `tests/admin/hr-menu-config.test.ts`

**Interfaces:**
- Consumes: `MenuConfig`, `filterAdminMenuItems`, `ADMIN_MENU_CONFIG`
- Produces: menu codes `HR`, `HR.EMPLOYEES`; permission resource `users` untuk keduanya

- [ ] **Step 1: Write the failing test**

Create `tests/admin/hr-menu-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("HR menu config (PRD-HR-MENU-SPLIT v2)", () => {
  it("punya parent HR dengan child Data Pegawai", () => {
    const hr = ADMIN_MENU_CONFIG.find((item) => item.code === "HR");
    expect(hr).toBeDefined();
    expect(hr?.name).toBe("HR");
    expect(hr?.path).toBe("/admin/hr");
    expect(hr?.featureModule).toBeUndefined();
    expect(hr?.section).toBe("SDM");

    const employees = hr?.children?.find((c) => c.code === "HR.EMPLOYEES");
    expect(employees).toBeDefined();
    expect(employees?.path).toBe("/admin/hr/employees");
    expect(employees?.featureModule).toBe("users");
  });

  it("USERS tetap top-level dengan path /admin/users", () => {
    const users = ADMIN_MENU_CONFIG.find((item) => item.code === "USERS");
    expect(users).toBeDefined();
    expect(users?.path).toBe("/admin/users");
    expect(users?.name).toBe("Pengguna");
  });

  it("Kehadiran dan Penggajian tetap top-level (bukan child HR)", () => {
    const hr = ADMIN_MENU_CONFIG.find((item) => item.code === "HR");
    const hrChildCodes = (hr?.children ?? []).map((c) => c.code);
    expect(hrChildCodes).not.toContain("KEHADIRAN");
    expect(hrChildCodes).not.toContain("SALARY");

    expect(ADMIN_MENU_CONFIG.some((i) => i.code === "KEHADIRAN")).toBe(true);
    expect(ADMIN_MENU_CONFIG.some((i) => i.code === "SALARY")).toBe(true);
  });

  it("filter menu: users:read menampilkan HR.EMPLOYEES", () => {
    const filtered = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "users:read",
      isFeatureEnabled: () => true,
    });
    const hr = filtered.find((item) => item.code === "HR");
    expect(hr).toBeDefined();
    expect(hr?.children?.some((c) => c.code === "HR.EMPLOYEES")).toBe(true);
  });

  it("filter menu: tanpa users:read menyembunyikan Data Pegawai", () => {
    const filtered = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "salary:read",
      isFeatureEnabled: () => true,
    });
    const hr = filtered.find((item) => item.code === "HR");
    // parent HR hilang jika tidak ada child lolos, atau child kosong
    const hasEmployees = hr?.children?.some((c) => c.code === "HR.EMPLOYEES");
    expect(hasEmployees).toBeFalsy();
  });

  it("specialMappings memetakan HR dan HR.EMPLOYEES ke users", () => {
    const source = readSource(
      "components/layout/admin-sidebar/adminSidebarMenu.ts",
    );
    expect(source).toMatch(/"HR"\s*:\s*"users"/);
    expect(source).toMatch(/"HR\.EMPLOYEES"\s*:\s*"users"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- tests/admin/hr-menu-config.test.ts
```

Expected: FAIL — `HR` not found / `Pengguna` name mismatch / specialMappings missing.

- [ ] **Step 3: Add specialMappings**

In `components/layout/admin-sidebar/adminSidebarMenu.ts`, inside `specialMappings`, add (dekat mapping SALARY):

```ts
    // HR menu: surface kepegawaian reuse permission users (fase 1 PRD)
    HR: "users",
    "HR.EMPLOYEES": "users",
```

Note: key `HR` tanpa quotes OK di TS object jika identifier valid; gunakan `"HR"` untuk konsistensi string keys lain.

- [ ] **Step 4: Insert menu block in `lib/menu-config.ts`**

Replace block `USERS` (Karyawan) dengan:

```ts
  {
    code: "USERS",
    name: "Pengguna",
    path: "/admin/users",
    icon: "HiOutlineUsers",
    section: "SDM",
    featureModule: "users",
  },
  {
    code: "HR",
    name: "HR",
    path: "/admin/hr",
    icon: "HiOutlineBriefcase",
    section: "SDM",
    // featureModule sengaja tidak di-set — parent container
    children: [
      {
        code: "HR.EMPLOYEES",
        name: "Data Pegawai",
        path: "/admin/hr/employees",
        icon: "HiOutlineIdentification",
        featureModule: "users",
      },
    ],
  },
```

Pastikan `HiOutlineBriefcase` / `HiOutlineIdentification` sudah didukung di `components/layout/admin-sidebar/adminSidebarIcons.tsx`. Jika icon belum terdaftar:

- [ ] **Step 4b: Register icons**

Buka `components/layout/admin-sidebar/adminSidebarIcons.tsx`. Jika map icon tidak punya key tersebut, tambahkan import dari `react-icons/hi2` dan entry map (ikuti pola existing). Jika `HiOutlineBriefcase` sudah dipakai Investor, OK reuse.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- tests/admin/hr-menu-config.test.ts
```

Expected: PASS all.

- [ ] **Step 6: Do not commit**

Verifikasi file berubah; **jangan** `git commit` / `git push`.

---

### Task 2: Extract shared HR form components

**Files:**
- Create: `app/admin/hr/_components/MultiSiteSelect.tsx`
- Create: `app/admin/hr/_components/OrganizationSection.tsx`
- Create: `app/admin/hr/_components/WorkingHoursSettings.tsx`
- Create: `app/admin/hr/_components/LeaveBalanceSettings.tsx`
- Create: `app/admin/hr/lib/siteHelpers.ts`
- Create: `app/admin/hr/lib/hrEmployeeApi.ts`
- Modify: `app/admin/users/components/UserFormSections.tsx` (re-export Organization dari HR)
- Modify: `app/admin/users/components/MultiSiteSelect.tsx` → re-export dari HR **atau** sebaliknya (satu canonical path: **HR**)
- Modify: `app/admin/users/[id]/WorkingHoursSettings.tsx` → re-export dari HR
- Modify: `app/admin/users/[id]/LeaveBalanceSettings.tsx` → re-export dari HR

**Interfaces:**
- Consumes: props existing `OrganizationSection`, `WorkingHoursSettings`, `LeaveBalanceSettings`, `MultiSiteSelect` (jangan ubah public props)
- Produces: canonical imports dari `@/app/admin/hr/_components/*` dan helpers di `app/admin/hr/lib/*`

- [ ] **Step 1: Write contract test for extract**

Append ke `tests/admin/hr-employees-surface.test.ts` (buat file):

```ts
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function pathOf(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(pathOf(relativePath), "utf8");
}

describe("HR shared components extract", () => {
  it("menyediakan komponen kepegawaian di app/admin/hr/_components", () => {
    for (const file of [
      "app/admin/hr/_components/OrganizationSection.tsx",
      "app/admin/hr/_components/WorkingHoursSettings.tsx",
      "app/admin/hr/_components/LeaveBalanceSettings.tsx",
      "app/admin/hr/_components/MultiSiteSelect.tsx",
      "app/admin/hr/lib/hrEmployeeApi.ts",
      "app/admin/hr/lib/siteHelpers.ts",
    ]) {
      expect(existsSync(pathOf(file)), `missing ${file}`).toBe(true);
    }
  });

  it("users WorkingHoursSettings re-export dari HR (tidak duplikasi logic)", () => {
    const usersWh = readSource("app/admin/users/[id]/WorkingHoursSettings.tsx");
    // Boleh full re-export atau file tipis
    expect(
      usersWh.includes("app/admin/hr/_components/WorkingHoursSettings") ||
        usersWh.includes("@/app/admin/hr/_components/WorkingHoursSettings") ||
        usersWh.includes("../hr/") === false, // path alias project
    ).toBeTruthy();
    // Lebih ketat: harus mengandung string path HR components
    expect(usersWh).toMatch(/hr\/_components\/WorkingHoursSettings/);
  });
});
```

Sesuaikan assertion path import agar match alias project (`@/` vs relative). Prefer:

```ts
export { default } from "@/app/admin/hr/_components/WorkingHoursSettings";
```

- [ ] **Step 2: Run test — expect FAIL (files missing)**

```bash
npm run test:run -- tests/admin/hr-employees-surface.test.ts
```

- [ ] **Step 3: Move MultiSiteSelect**

1. Copy isi penuh `app/admin/users/components/MultiSiteSelect.tsx` → `app/admin/hr/_components/MultiSiteSelect.tsx` (update import relatif jika ada).
2. Ganti `app/admin/users/components/MultiSiteSelect.tsx` menjadi:

```tsx
export { default } from "@/app/admin/hr/_components/MultiSiteSelect";
```

- [ ] **Step 4: Move OrganizationSection**

1. Pindahkan function `OrganizationSection` + props types dari `UserFormSections.tsx` ke `app/admin/hr/_components/OrganizationSection.tsx`.
2. Import `MultiSiteSelect` dari `./MultiSiteSelect`.
3. Import types `ReferenceDepartment` / `ReferenceSite` dari `@/app/admin/users/lib/userDetailApi` **atau** duplicate minimal interface di HR lib (prefer import dari userDetailApi untuk DRY).
4. Di `UserFormSections.tsx`, ganti body OrganizationSection dengan:

```tsx
export { OrganizationSection } from "@/app/admin/hr/_components/OrganizationSection";
// StatusAndSalesSection tetap di file ini
```

- [ ] **Step 5: Move WorkingHoursSettings & LeaveBalanceSettings**

1. Copy file ke `app/admin/hr/_components/`.
2. File lama di users jadi re-export default.
3. Pastikan import internal (icons, toast, fetch leave) tetap valid.

- [ ] **Step 6: siteHelpers + hrEmployeeApi**

`app/admin/hr/lib/siteHelpers.ts`:

```ts
export {
  normalizeSelectedSites,
  getSelectedSitesFromUser,
  getSitesFromUser,
  mergeSites,
} from "@/app/admin/users/[id]/user-detail-helpers";
```

Jika path `[id]` awkward untuk import, **copy** function bodies ke `siteHelpers.ts` (file helpers kecil ~80 baris) dan biarkan users tetap punya original — lebih baik **satu** source: pindah helpers ke `app/admin/users/lib/siteHelpers.ts` lalu re-export ke HR. **Pilih:**

Canonical: `app/admin/users/lib/siteHelpers.ts` (move dari `[id]/user-detail-helpers.ts`), lalu:

- `app/admin/users/[id]/user-detail-helpers.ts` re-export
- `app/admin/hr/lib/siteHelpers.ts` re-export

`app/admin/hr/lib/hrEmployeeApi.ts`:

```ts
export {
  fetchAdminUserDetail,
  fetchDepartments,
  fetchActiveSites,
  updateAdminUser,
  saveLeaveQuotas,
  type ReferenceDepartment,
  type ReferenceSite,
} from "@/app/admin/users/lib/userDetailApi";
```

- [ ] **Step 7: Run tests**

```bash
npm run test:run -- tests/admin/hr-employees-surface.test.ts tests/admin/hr-menu-config.test.ts
```

Expected: extract tests PASS. Fix import paths jika typecheck gagal.

- [ ] **Step 8: Typecheck touched area**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Atau project script: `npm run typecheck` (boleh lama). Minimal: pastikan tidak ada error di path `app/admin/hr` dan re-export users.

- [ ] **Step 9: Do not commit**

---

### Task 3: HR employees list page

**Files:**
- Create: `app/admin/hr/employees/page.tsx`
- Create: `app/admin/hr/employees/HrEmployeesListClient.tsx`
- Modify: `tests/admin/hr-employees-surface.test.ts` (assert list client exists + uses users API)

**Interfaces:**
- Consumes: `fetchUsers` from `app/admin/users/lib/userApi.ts` **atau** `useUserFetch` / simple `fetch('/api/admin/users?limit=...')`
- Produces: page at `/admin/hr/employees` gated `users:read`

- [ ] **Step 1: Extend contract test**

```ts
  it("list page HR employees me-require users:read", () => {
    const page = readSource("app/admin/hr/employees/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
    expect(page).toContain("HrEmployeesListClient");
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Server page**

`app/admin/hr/employees/page.tsx`:

```tsx
import { ensurePermission } from "@/lib/rbac";
import { HrEmployeesListClient } from "./HrEmployeesListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Pegawai - HR - Admin Portal",
};

export default async function HrEmployeesPage() {
  await ensurePermission("users:read");
  return <HrEmployeesListClient />;
}
```

- [ ] **Step 4: List client (minimal, HR columns)**

`app/admin/hr/employees/HrEmployeesListClient.tsx` — pola mirip list sederhana:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import PageLoader from "@/components/ui/PageLoader";
import type { UserListItemDTO } from "@/modules/users";

export function HrEmployeesListClient() {
  const [users, setUsers] = useState<UserListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", page: "1" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat data pegawai");
      const data = await res.json();
      setUsers(data.data?.users ?? data.data ?? []);
    } catch (error) {
      clientLogger.error("HR employees list", error);
      toast.error("Gagal memuat data pegawai");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Data Pegawai
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola penempatan, jam kerja, dan kuota cuti. Akun login ada di menu
            Pengguna.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-indigo-600 hover:underline"
        >
          Kelola akun Pengguna →
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama atau email..."
        className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Departemen</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Jam kerja</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {user.name || "—"}
                  <div className="text-xs text-gray-500">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  {user.department?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {user.site?.name ?? user.site?.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {/* field optional di DTO — tampilkan jika ada */}
                  {(user as { workingHourMode?: string }).workingHourMode ??
                    "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/hr/employees/${user.id}`}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    Kelola kepegawaian
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="p-8 text-center text-gray-500">Tidak ada data</p>
        )}
      </div>
    </div>
  );
}
```

Sesuaikan shape response list dengan `fetchUsers` / `UserListItemDTO` actual (cek `modules/users` DTO). Jika `department` nested beda, ikuti field real dari `UserList.tsx` / `userColumns.tsx`.

- [ ] **Step 5: Run contract tests**

```bash
npm run test:run -- tests/admin/hr-employees-surface.test.ts
```

- [ ] **Step 6: Do not commit**

---

### Task 4: HR employee detail (kepegawaian only)

**Files:**
- Create: `app/admin/hr/employees/[id]/page.tsx`
- Create: `app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx`

**Interfaces:**
- Consumes: `fetchAdminUserDetail`, `updateAdminUser`, `saveLeaveQuotas`, `OrganizationSection`, `WorkingHoursSettings`, `LeaveBalanceSettings`, site helpers
- Produces: PATCH body **hanya** field HR:

```ts
type HrUpdateBody = {
  departmentId: string | null;
  userSites: { siteId: string; isPrimary: boolean }[];
  workingHourMode: string;
  attendanceGeofencePolicy?: string;
  isAttendanceRequired?: boolean;
  startWorkTime: string | null;
  endWorkTime: string | null;
  workDays: string | null;
  flexibleTargetHour: number | null;
  shiftId: string | null;
};
```

- [ ] **Step 1: Contract test**

```ts
  it("detail page HR employees me-require users:read", () => {
    const page = readSource("app/admin/hr/employees/[id]/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
  });

  it("detail client tidak mengirim password/role", () => {
    const client = readSource(
      "app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx",
    );
    expect(client).not.toMatch(/password\s*:/);
    expect(client).not.toMatch(/roleId\s*:/);
    expect(client).toContain("OrganizationSection");
    expect(client).toContain("WorkingHoursSettings");
    expect(client).toContain("LeaveBalanceSettings");
    expect(client).toContain("updateAdminUser");
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Server page**

```tsx
import { ensurePermission } from "@/lib/rbac";
import { HrEmployeeDetailClient } from "./HrEmployeeDetailClient";

export const dynamic = "force-dynamic";

export default async function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("users:read");
  return <HrEmployeeDetailClient params={params} />;
}
```

- [ ] **Step 4: Detail client — implementasi minimal lengkap**

Struktur wajib:

1. `use(params)` → `id`
2. Load user via `fetchAdminUserDetail(id)`
3. Load departments + sites via `fetchDepartments` / `fetchActiveSites`
4. State: `departmentId`, `selectedSites`, working hour fields, `leaveQuotas`
5. `canUpdate = hasPermission("users:update")`
6. `canManageLeaveQuotas` — ikuti logika di `UsersDetailClient` (permission leave jika ada; else `users:update`)
7. Submit:
   - `updateAdminUser(id, hrBody)` — **tanpa** name/email/password/role/isActive/isSales
   - `saveLeaveQuotas` jika mode ≠ FLEXIBLE dan quotas berubah
8. UI:
   - Header: nama + email read-only + link `Ke akun Pengguna` → `/admin/users/${id}`
   - `OrganizationSection`
   - `WorkingHoursSettings`
   - `LeaveBalanceSettings` (jika allowed)
   - Tombol Simpan

Skeleton inti submit:

```ts
await updateAdminUser(id, {
  departmentId: formData.departmentId || null,
  userSites: normalizeSelectedSites(selectedSites),
  workingHourMode: formData.workingHourMode,
  attendanceGeofencePolicy: formData.attendanceGeofencePolicy,
  isAttendanceRequired: formData.isAttendanceRequired,
  startWorkTime: formData.startWorkTime || null,
  endWorkTime: formData.endWorkTime || null,
  workDays: formData.workDays || null,
  flexibleTargetHour:
    formData.flexibleTargetHour === "" || formData.flexibleTargetHour == null
      ? null
      : Number(formData.flexibleTargetHour),
  shiftId: formData.shiftId || null,
});
```

Salin inisialisasi form dari `UsersDetailClient` load effect (hanya field HR). Jangan copy password/role state.

- [ ] **Step 5: Run contract tests + typecheck file**

```bash
npm run test:run -- tests/admin/hr-employees-surface.test.ts
```

- [ ] **Step 6: Do not commit**

---

### Task 5: Strip HR sections from Pengguna (edit + new + view)

**Files:**
- Modify: `app/admin/users/[id]/UsersDetailClient.tsx`
- Modify: `app/admin/users/[id]/UsersDetailView.tsx`
- Modify: `app/admin/users/new/UsersNewClient.tsx`
- Modify: `tests/admin/hr-employees-surface.test.ts`

**Interfaces:**
- Consumes: HR routes from Task 3–4
- Produces: edit form tanpa Organization/WorkingHours/LeaveBalance; updateBody tanpa field HR

- [ ] **Step 1: Failing/contract assertions for strip**

```ts
  it("edit UsersDetailClient tidak mount section kepegawaian", () => {
    const src = readSource("app/admin/users/[id]/UsersDetailClient.tsx");
    // Section HR dipindah — tidak boleh render komponen ini di edit form
    expect(src).not.toContain("<OrganizationSection");
    expect(src).not.toContain("<WorkingHoursSettings");
    expect(src).not.toContain("<LeaveBalanceSettings");
    expect(src).toContain("/admin/hr/employees/");
  });

  it("create user tidak mount jam kerja / kuota cuti", () => {
    const src = readSource("app/admin/users/new/UsersNewClient.tsx");
    expect(src).not.toContain("<WorkingHoursSettings");
    expect(src).not.toContain("<LeaveBalanceSettings");
    // dept/site onboarding tetap
    expect(src).toContain("OrganizationSection");
  });
```

- [ ] **Step 2: Run — expect FAIL (masih ada section)**

- [ ] **Step 3: Edit `UsersDetailClient`**

1. Hapus import `OrganizationSection`, `WorkingHoursSettings`, `LeaveBalanceSettings` (jika tidak dipakai).
2. Hapus JSX blocks L660–715 (Organization, WorkingHours, LeaveBalance) — ganti dengan CTA banner:

```tsx
{canUpdate && (
  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h2 className="font-semibold text-gray-900 dark:text-white">
        Data kepegawaian
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Departemen, site, jam kerja, dan kuota cuti dikelola di menu HR.
      </p>
    </div>
    <Link
      href={`/admin/hr/employees/${id}`}
      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
    >
      Buka di HR
    </Link>
  </div>
)}
```

3. Di `updateBody` (handleSubmit), **hapus** keys:

```ts
// HAPUS dari updateBody:
// departmentId, userSites, workingHourMode, attendanceGeofencePolicy,
// isAttendanceRequired, startWorkTime, endWorkTime, workDays,
// flexibleTargetHour, shiftId
// HAPUS blok saveLeaveQuotas
```

Body tersisa contoh:

```ts
const updateBody: Record<string, unknown> = {
  name: formData.name,
  phone: formData.phone || null,
  roleId: formData.roleId,
  isActive: formData.isActive,
  isSales: formData.isSales,
  canvasingTarget: normalizeNumericField(formData.canvasingTarget),
  targetSchema: formData.targetSchema,
  tenantId: formData.tenantId || null,
};
if (formData.password) updateBody.password = formData.password;
```

4. Bersihkan state/effect yang **hanya** dipakai HR jika jadi dead code (leaveQuotas, selectedSites di edit — boleh hapus untuk hindari smell). Hati-hati jangan pecah view mode.

5. Pertahankan `StatusAndSalesSection`.

- [ ] **Step 4: Edit `UsersNewClient`**

1. Hapus mount `WorkingHoursSettings` dan `LeaveBalanceSettings`.
2. Hapus payload create fields jam kerja / leave jika di-submit (ikuti field yang API create terima — jangan kirim leave quotas).
3. **Pertahankan** `OrganizationSection` + selectedSites di create body.

- [ ] **Step 5: Edit `UsersDetailView`**

1. Card jam kerja panjang: ganti ringkas + Link ke `/admin/hr/employees/${userId}`.
2. `LeaveQuotaSummary`: ganti dengan CTA yang sama **atau** biarkan read-only summary + link “Kelola di HR”.
3. Dept/site cards: boleh tetap read-only (informasi) + link edit di HR.

- [ ] **Step 6: Run contract tests**

```bash
npm run test:run -- tests/admin/hr-menu-config.test.ts tests/admin/hr-employees-surface.test.ts
```

Expected: PASS.

- [ ] **Step 7: Do not commit**

---

### Task 6: Landing `/admin/hr`

**Files:**
- Create: `app/admin/hr/page.tsx`
- Modify: `tests/admin/hr-employees-surface.test.ts`

- [ ] **Step 1: Contract test**

```ts
  it("landing HR mem-require users:read dan link ke employees", () => {
    const page = readSource("app/admin/hr/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
    expect(page).toContain("/admin/hr/employees");
  });
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement landing** (pola procurement, thin):

```tsx
import Link from "next/link";
import {
  HiOutlineIdentification,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
} from "react-icons/hi2";
import { ensurePermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HR - Admin Portal",
};

const CARDS = [
  {
    href: "/admin/hr/employees",
    title: "Data Pegawai",
    description:
      "Departemen, site, jam kerja, dan kuota cuti. Akun login ada di menu Pengguna.",
    icon: HiOutlineIdentification,
  },
  {
    href: "/admin/users",
    title: "Akun Pengguna",
    description: "Email, role, password, status aktif, dan force logout.",
    icon: HiOutlineUsers,
  },
  {
    href: "/admin/kehadiran",
    title: "Kehadiran",
    description: "Absensi, shift, lembur, izin, dan hari libur (menu terpisah).",
    icon: HiOutlineClipboardDocumentCheck,
  },
  {
    href: "/admin/salary",
    title: "Penggajian",
    description: "Payroll dan profil gaji (menu terpisah).",
    icon: HiOutlineCurrencyDollar,
  },
] as const;

export default async function HrLandingPage() {
  await ensurePermission("users:read");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pusat data kepegawaian. Kehadiran dan penggajian tetap di menu masing-masing.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="block p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <Icon className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run all HR tests**

```bash
npm run test:run -- tests/admin/hr-menu-config.test.ts tests/admin/hr-employees-surface.test.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 7: Changelog, PRD status, manual QA

**Files:**
- Modify: `docs/CHANGELOG.md` (`[Unreleased]`)
- Modify: `docs/specifications/PRD-HR-MENU-SPLIT-2026-07-20.md` (status)
- Optional: `docs/guides/menu-configuration.md`

- [ ] **Step 1: Changelog entries** (dua entry logis)

Di atas entri Unreleased terbaru, tambahkan:

```markdown
### [2026-07-20] — Menu HR Data Pegawai

- **Tipe**: [ADDED]
- **Scope**: `app/admin/hr`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Menu sidebar HR + halaman Data Pegawai (list/detail) untuk kelola departemen, multi-site, jam kerja, dan kuota cuti. Permission di-map ke `users:*`. Reuse API `modules/users` / leave-balance. Tanpa migration.
- **Files**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `app/admin/hr/**`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Form Pengguna tanpa section kepegawaian

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/users`
- **Author**: agent
- **Deskripsi**: Edit/view Pengguna fokusus IAM (kredensial, role, status, sales). Section kepegawaian dipindah ke `/admin/hr/employees/[id]`. Create user tetap boleh set dept/site; jam kerja & kuota cuti hanya di HR.
- **Files**: `app/admin/users/[id]/UsersDetailClient.tsx`, `UsersDetailView.tsx`, `app/admin/users/new/UsersNewClient.tsx`
- **Breaking**: ❌ Tidak (path `/admin/users` tetap; field HR di-edit lewat path baru)
```

- [ ] **Step 2: Update PRD status**

Di PRD v2 header:

```markdown
| **Status** | Implemented (Fase 1) — menunggu commit/push user |
```

Riwayat: tambah baris tanggal implement.

- [ ] **Step 3: Manual QA checklist** (jalankan di browser / catat hasil)

| # | Langkah | Expected |
|---|---------|----------|
| 1 | Login admin full permission | Sidebar: **Pengguna** + **HR → Data Pegawai**; Kehadiran & Gaji masih top-level |
| 2 | Buka `/admin/hr` | Landing cards OK |
| 3 | Buka Data Pegawai → pilih user | Form dept/site/jam kerja/cuti |
| 4 | Ubah jam kerja → Simpan → refresh | Nilai tersimpan |
| 5 | Ubah kuota cuti → Simpan | Tersimpan |
| 6 | Buka `/admin/users/[id]` edit | **Tidak** ada form jam kerja/cuti/org; ada CTA “Buka di HR” |
| 7 | Ubah role/password di Pengguna | Berhasil; data HR tidak ter-reset |
| 8 | Create user baru + dept | User muncul di list HR |
| 9 | Role tanpa `users:read` | Menu HR employees tidak muncul |
| 10 | CommandPalette cari “Data Pegawai” / “HR” | Navigasi benar |

- [ ] **Step 4: Final automated tests**

```bash
npm run test:run -- tests/admin/hr-menu-config.test.ts tests/admin/hr-employees-surface.test.ts
```

Expected: PASS.

- [ ] **Step 5: Explicitly do NOT commit or push**

Laporkan ke user: file berubah, test hijau, QA manual status. Tunggu instruksi commit.

---

## Self-review (plan vs PRD v2)

| PRD requirement | Task |
|-----------------|------|
| T1 Menu HR sidebar | Task 1 |
| T2 Fungsi kepegawaian terpisah | Task 4 + 5 |
| T3 Karyawan/Pengguna fokusus IAM | Task 5 |
| T4 Satu sumber User API | Task 2–4 (reuse API) |
| T5 Deep link IAM tidak putus | Task 5 (path users tetap) |
| T6 Permission users:* | Task 1 specialMappings |
| Non-tujuan: tidak gabung Kehadiran/Gaji | Task 1 test asserts |
| Non-tujuan: no migration | Global + no prisma tasks |
| Non-tujuan: no commit otomatis | Every task Step “Do not commit” |
| D11 create dept/site OK, jam/cuti di HR | Task 5 new client |
| Landing 1b | Task 6 |
| Changelog SOT | Task 7 |

**Placeholder scan:** tidak ada TBD/TODO kosong di step implementasi.

**Type consistency:** `HrUpdateBody` fields match keys yang di-strip dari `UsersDetailClient` updateBody; API `updateAdminUser(userId, body)`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-hr-menu-employee-split.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

**Catatan project:** commit/push tetap **off** sampai Anda minta — kedua mode hanya menulis kode + test + changelog.

**Which approach?**
