# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan redesign satu gelombang untuk dashboard admin, RADIUS, dan customer agar contract data konsisten, boundary auth/permission tegas, summary kritis memakai source yang benar, dan semua failure mode tampil jujur.

**Architecture:** Pertahankan karakter tiap surface: admin tetap server-driven, RADIUS tetap client-stateful, customer tetap portal-centric. Semua surface dipindahkan ke pola yang sama: source domain → dashboard composer/service → view-model mapper → UI. Untuk client dashboard, gunakan helper fetch dan state module yang memvalidasi envelope `apiSuccess` secara eksplisit sehingga UI tidak lagi menebak format respons. Cleanup akhir harus menghapus fallback parsing rapuh dari caller dashboard aktif.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, NextAuth 4, Prisma 7, Zod 4, Vitest 4.

---

## Asumsi eksekusi

- User sudah memilih **satu gelombang**, jadi tetap satu plan walau menyentuh tiga dashboard.
- Standardisasi contract memanfaatkan helper `apiSuccess` yang sudah ada; scope perubahan difokuskan pada dashboard caller internal web, bukan semua endpoint aplikasi.
- Perubahan auth customer dipersempit ke dashboard dan helper auth terkait, bukan seluruh portal customer.

## File structure

### Shared dashboard foundation
- Create: `lib/dashboard/contracts.ts` — tipe generic untuk section state dashboard (`ready` / `error`) dan helper envelope yang dipakai mapper/UI.
- Create: `lib/dashboard/fetchDashboardResource.ts` — helper fetch client yang memeriksa `response.ok`, mem-parse envelope `apiSuccess`, dan memvalidasi shape dengan Zod.
- Modify: `lib/auth.ts` — helper canonical super-admin agar rule tidak tersebar dalam variasi berbeda.
- Modify: `lib/server-auth.ts` — helper `ensureAdminDashboardAccess()` yang menjadi feature boundary tunggal untuk `/admin`.

### Admin dashboard
- Create: `modules/admin/services/dashboard/admin-dashboard.contracts.ts` — contract hasil composer untuk UI admin.
- Create: `modules/admin/services/dashboard/admin-dashboard.mapper.ts` — mapper domain result → view model admin.
- Create: `modules/admin/services/dashboard/AdminDashboardComposer.ts` — composer utama admin yang mengorkestrasi data per section dan menandai section error secara jujur.
- Modify: `modules/admin/services/DashboardService.ts` — semua aggregate method menerima context tenant eksplisit.
- Modify: `modules/admin/services/AdminDashboardPageService.ts` — jadikan adapter tipis ke composer baru atau hapus jika sudah tidak diperlukan.
- Modify: `app/admin/page.tsx` — page entry tipis: access boundary + load view model.
- Modify: `app/admin/AdminDashboardClient.tsx` — pure presentational wrapper berbasis view model.
- Create: `app/admin/_components/AdminDashboardHero.tsx` — hero section admin.
- Create: `app/admin/_components/AdminDashboardOverviewSection.tsx` — section attendance/workorder/marketing/inventory.
- Create: `app/admin/_components/AdminDashboardKpiSection.tsx` — KPI router/sessions.
- Create: `app/admin/_components/AdminDashboardLeaderboardSection.tsx` — leaderboard employee dan site tables.
- Modify: `components/dashboard/DashboardSocketUpdate.tsx` — refresh guard terkontrol, tidak blind refresh beruntun.

### RADIUS dashboard
- Create: `modules/network/services/dashboard/radius-dashboard.contracts.ts` — contract typed untuk stats, sessions, history, dan reset result.
- Create: `modules/network/services/dashboard/radius-dashboard.mapper.ts` — mapper hasil repository/service ke shape route yang stabil.
- Create: `modules/network/services/dashboard/RadiusDashboardService.ts` — service tipis untuk stats dan recent sessions agar route tidak gemuk.
- Create: `app/admin/network/radius/lib/radiusDashboardApi.ts` — client fetchers typed berbasis `fetchDashboardResource()`.
- Create: `app/admin/network/radius/lib/radiusDashboardState.ts` — state transition utama dashboard (`refresh`, realtime stats, realtime sessions).
- Create: `app/admin/network/radius/lib/radiusHistoryState.ts` — state transition history modal.
- Create: `app/admin/network/radius/lib/radiusResetState.ts` — state transition reset action.
- Modify: `app/admin/network/radius/hooks/useRadiusDashboardData.ts` — hook komposer tipis yang memakai state modules di atas.
- Modify: `app/admin/network/radius/RadiusDashboard.tsx` — UI menampilkan error per concern dan hanya consume state siap render.
- Modify: `app/api/admin/radius/dashboard/stats/route.ts` — route tipis dengan service + contract baru.
- Modify: `app/api/admin/radius/dashboard/recent-sessions/route.ts` — route tipis dengan service + contract baru.
- Modify: `app/api/admin/radius/sessions/[username]/history/route.ts` — contract history eksplisit.
- Modify: `app/api/admin/radius/sessions/reset/route.ts` — standardisasi success/error payload untuk action reset.

### Customer dashboard
- Create: `modules/pelanggan/services/dashboard/customer-dashboard.contracts.ts` — contract typed untuk profile summary, connection summary, billing summary, dan section state.
- Create: `modules/pelanggan/services/dashboard/customer-dashboard.mapper.ts` — mapper source result → view model customer.
- Create: `modules/pelanggan/services/dashboard/CustomerDashboardService.ts` — composer customer dashboard dan source-of-truth billing summary.
- Modify: `modules/pelanggan/repositories/CustomerInvoiceRepository.ts` — query summary tagihan berdasarkan `dueDate` dan outstanding amount yang benar.
- Modify: `lib/customer-auth.ts` — helper page-level auth untuk dashboard customer.
- Create: `app/api/customer/dashboard/summary/route.ts` — endpoint tunggal untuk kebutuhan dashboard customer.
- Modify: `app/api/customer/invoices/route.ts` — samakan contract ke `apiSuccess({ invoices, pagination })`.
- Modify: `app/(customer)/dashboard/page.tsx` — ubah menjadi server entry yang menegakkan auth sebelum render.
- Create: `app/(customer)/dashboard/CustomerDashboardClient.tsx` — UI customer yang consume view model dashboard, bukan tiga fetch paralel liar.

### Tests and verification
- Create: `tests/lib/dashboard/fetchDashboardResource.test.ts` — helper fetch dashboard.
- Create: `tests/lib/server-auth-dashboard.test.ts` — feature boundary admin dashboard.
- Create: `tests/modules/admin/AdminDashboardComposer.test.ts` — tenant scoping dan section failure admin.
- Create: `tests/components/dashboard/DashboardSocketUpdate.test.tsx` — refresh guard admin realtime.
- Create: `tests/modules/network/RadiusDashboardService.test.ts` — contract shaping RADIUS.
- Create: `tests/app/admin/network/radius/radiusDashboardState.test.ts` — behavior-driven state transition RADIUS.
- Modify: `tests/lib/useRadiusDashboardData.test.ts` — jika masih dipertahankan, fokuskan ke public API hook, bukan urutan `useState`.
- Create: `tests/modules/pelanggan/CustomerDashboardService.test.ts` — billing summary correctness dan partial failure.
- Create: `tests/app/api/customer/invoices.route.test.ts` — envelope route invoices.
- Create: `tests/lib/customer-auth-page.test.ts` — page-level auth customer.

## Task 1: Fondasi contract client dan boundary auth admin

**Files:**
- Create: `lib/dashboard/contracts.ts`
- Create: `lib/dashboard/fetchDashboardResource.ts`
- Modify: `lib/auth.ts`
- Modify: `lib/server-auth.ts`
- Test: `tests/lib/dashboard/fetchDashboardResource.test.ts`
- Test: `tests/lib/server-auth-dashboard.test.ts`

- [ ] **Step 1: Tulis failing test untuk helper fetch dashboard**

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DashboardHttpError, fetchDashboardResource } from "@/lib/dashboard/fetchDashboardResource";

const statsSchema = z.object({
  totalUsers: z.number(),
  onlineUsers: z.number(),
});

describe("fetchDashboardResource", () => {
  it("returns parsed data from apiSuccess envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { totalUsers: 42, onlineUsers: 17 },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await fetchDashboardResource("/api/admin/radius/dashboard/stats", statsSchema);

    expect(result).toEqual({ totalUsers: 42, onlineUsers: 17 });
  });

  it("throws DashboardHttpError when response is non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Tenant tidak valid" }), { status: 403 }),
      ),
    );

    await expect(
      fetchDashboardResource("/api/admin/radius/dashboard/stats", statsSchema),
    ).rejects.toMatchObject({
      name: "DashboardHttpError",
      status: 403,
      message: "Tenant tidak valid",
    });
  });
});
```

- [ ] **Step 2: Jalankan test helper fetch dan pastikan merah**

Run: `npm run test:run -- tests/lib/dashboard/fetchDashboardResource.test.ts`
Expected: FAIL karena `fetchDashboardResource` dan `DashboardHttpError` belum ada.

- [ ] **Step 3: Implement helper contract dashboard bersama**

```ts
import { ZodType } from "zod";

export type DashboardSectionState = "ready" | "error";

export interface DashboardSection<T> {
  state: DashboardSectionState;
  data: T | null;
  message?: string;
}

export class DashboardHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DashboardHttpError";
  }
}

function getDashboardErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown; message?: unknown };
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  }

  return "Gagal memuat data dashboard";
}

export async function fetchDashboardResource<T>(
  input: RequestInfo | URL,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new DashboardHttpError(getDashboardErrorMessage(payload), response.status, payload);
  }

  const envelopeData =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  const parsed = schema.safeParse(envelopeData);
  if (!parsed.success) {
    throw new DashboardHttpError("Format respons dashboard tidak valid", 500, parsed.error.flatten());
  }

  return parsed.data;
}
```

- [ ] **Step 4: Jalankan ulang test helper fetch**

Run: `npm run test:run -- tests/lib/dashboard/fetchDashboardResource.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis failing test untuk feature boundary admin dashboard**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
const mockGetUserPermissions = vi.fn();
const mockRedirect = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

vi.mock("next/navigation", () => ({
  redirect: (location: string) => mockRedirect(location),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getUserPermissions: mockGetUserPermissions,
  };
});

import { ensureAdminDashboardAccess } from "@/lib/server-auth";

describe("ensureAdminDashboardAccess", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockGetUserPermissions.mockReset();
    mockRedirect.mockReset();
  });

  it("loads permissions from the canonical loader for regular admins", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", tenantId: "tenant-1", isSuperAdmin: false },
    });
    mockGetUserPermissions.mockResolvedValue(["dashboard:read"]);

    const result = await ensureAdminDashboardAccess();

    expect(result.tenantId).toBe("tenant-1");
    expect(mockGetUserPermissions).toHaveBeenCalledWith("user-1");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to forbidden when dashboard:read is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", tenantId: "tenant-2", isSuperAdmin: false },
    });
    mockGetUserPermissions.mockResolvedValue(["users:read"]);

    await ensureAdminDashboardAccess();

    expect(mockRedirect).toHaveBeenCalledWith("/admin/forbidden");
  });
});
```

- [ ] **Step 6: Jalankan test feature boundary admin dan pastikan merah**

Run: `npm run test:run -- tests/lib/server-auth-dashboard.test.ts`
Expected: FAIL karena `ensureAdminDashboardAccess` belum ada.

- [ ] **Step 7: Implement helper canonical super admin dan access loader admin dashboard**

```ts
export function isSuperAdminUser(user: {
  role?: string | null;
  isSuperAdmin?: boolean | null;
}): boolean {
  if (user.isSuperAdmin) return true;

  return user.role === "SUPER_ADMIN" || user.role === "Super Admin";
}
```

```ts
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getUserPermissions, isSuperAdminUser } from "@/lib/auth";

export async function ensureAdminDashboardAccess(permission = "dashboard:read") {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.tenantId) {
    redirect("/admin/login");
  }

  const isSuperAdmin = isSuperAdminUser({
    role: session.user.role,
    isSuperAdmin: session.user.isSuperAdmin,
  });

  const permissions = isSuperAdmin ? ["*"] : await getUserPermissions(session.user.id);
  if (!isSuperAdmin && !permissions.includes(permission)) {
    redirect("/admin/forbidden");
  }

  return {
    user: session.user,
    tenantId: session.user.tenantId,
    permissions,
    isSuperAdmin,
  };
}
```

- [ ] **Step 8: Jalankan ulang dua test foundation**

Run: `npm run test:run -- tests/lib/dashboard/fetchDashboardResource.test.ts tests/lib/server-auth-dashboard.test.ts`
Expected: PASS.

## Task 2: Composer admin dashboard dan view-model jujur

**Files:**
- Create: `modules/admin/services/dashboard/admin-dashboard.contracts.ts`
- Create: `modules/admin/services/dashboard/admin-dashboard.mapper.ts`
- Create: `modules/admin/services/dashboard/AdminDashboardComposer.ts`
- Modify: `modules/admin/services/DashboardService.ts`
- Modify: `modules/admin/services/AdminDashboardPageService.ts`
- Test: `tests/modules/admin/AdminDashboardComposer.test.ts`

- [ ] **Step 1: Tulis failing test untuk tenant scoping dan section failure admin**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardComposer } from "@/modules/admin/services/dashboard/AdminDashboardComposer";

const mockRouterRepository = {
  getStatistics: vi.fn(),
};

const mockDashboardService = {
  getSystemSummary: vi.fn(),
  getTopEmployees: vi.fn(),
  getTopProblematicSites: vi.fn(),
  getTopDismantleSites: vi.fn(),
  getTopInstallationSites: vi.fn(),
};

describe("AdminDashboardComposer", () => {
  beforeEach(() => {
    mockRouterRepository.getStatistics.mockResolvedValue({ total: 10, online: 8, offline: 2, totalUserOnline: 17 });
    mockDashboardService.getSystemSummary.mockResolvedValue({
      attendance: { present: 12, late: 1, absent: 2 },
      workOrder: { pending: 3, inProgress: 4, completed: 9 },
      marketing: { totalPoints: 200, approvedClaims: 3, pendingClaims: 1 },
      inventory: { totalItems: 55 },
    });
    mockDashboardService.getTopEmployees.mockResolvedValue([]);
    mockDashboardService.getTopProblematicSites.mockResolvedValue([]);
    mockDashboardService.getTopDismantleSites.mockResolvedValue([]);
    mockDashboardService.getTopInstallationSites.mockResolvedValue([]);
  });

  it("forwards tenantId to every aggregate query", async () => {
    const composer = new AdminDashboardComposer(mockRouterRepository as never, mockDashboardService as never);

    await composer.compose({ tenantId: "tenant-1", viewerName: "Rohadi", now: new Date("2026-04-12T08:00:00.000Z") });

    expect(mockRouterRepository.getStatistics).toHaveBeenCalledWith("tenant-1");
    expect(mockDashboardService.getSystemSummary).toHaveBeenCalledWith({ tenantId: "tenant-1" });
    expect(mockDashboardService.getTopEmployees).toHaveBeenCalledWith({ tenantId: "tenant-1", limit: 5 });
  });

  it("marks the leaderboard section as error when one aggregate fails", async () => {
    mockDashboardService.getTopEmployees.mockRejectedValue(new Error("Leaderboard gagal"));

    const composer = new AdminDashboardComposer(mockRouterRepository as never, mockDashboardService as never);
    const result = await composer.compose({ tenantId: "tenant-1", viewerName: "Rohadi", now: new Date("2026-04-12T08:00:00.000Z") });

    expect(result.leaderboards.state).toBe("error");
    expect(result.leaderboards.message).toBe("Leaderboard gagal");
    expect(result.kpis.state).toBe("ready");
  });
});
```

- [ ] **Step 2: Jalankan test composer admin dan pastikan merah**

Run: `npm run test:run -- tests/modules/admin/AdminDashboardComposer.test.ts`
Expected: FAIL karena composer dan contract baru belum ada.

- [ ] **Step 3: Definisikan contract admin dashboard per section**

```ts
import type { DashboardSection } from "@/lib/dashboard/contracts";

export interface AdminDashboardHeroViewModel {
  greeting: string;
  generatedAtLabel: string;
}

export interface AdminDashboardOverviewCards {
  attendance: { present: number; late: number; absent: number };
  workOrder: { pending: number; inProgress: number; completed: number };
  marketing: { totalPoints: number; approvedClaims: number; pendingClaims: number };
  inventory: { totalItems: number };
}

export interface AdminDashboardKpiCards {
  activeSessions: number;
  totalRouters: number;
  onlineRouters: number;
  offlineRouters: number;
}

export interface AdminDashboardLeaderboards {
  topEmployees: unknown[];
  topProblematicSites: unknown[];
  topDismantleSites: unknown[];
  topInstallationSites: unknown[];
}

export interface AdminDashboardViewModel {
  hero: AdminDashboardHeroViewModel;
  overview: DashboardSection<AdminDashboardOverviewCards>;
  kpis: DashboardSection<AdminDashboardKpiCards>;
  leaderboards: DashboardSection<AdminDashboardLeaderboards>;
}
```

- [ ] **Step 4: Implement composer admin berbasis `Promise.allSettled()` dan mapper view-model**

```ts
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { MikroTikRouterRepository } from "@/modules/network";
import { getDashboardService } from "@/modules/admin";
import type { DashboardSection } from "@/lib/dashboard/contracts";
import type { AdminDashboardViewModel } from "./admin-dashboard.contracts";

function mapSettledSection<T>(result: PromiseSettledResult<T>, message: string): DashboardSection<T> {
  if (result.status === "fulfilled") {
    return { state: "ready", data: result.value };
  }

  return {
    state: "error",
    data: null,
    message: result.reason instanceof Error ? result.reason.message : message,
  };
}

export class AdminDashboardComposer {
  constructor(
    private readonly routerRepository = new MikroTikRouterRepository(),
    private readonly dashboardService = getDashboardService(),
  ) {}

  async compose(input: { tenantId: string; viewerName: string; now: Date }): Promise<AdminDashboardViewModel> {
    const [routerStats, systemSummary, topEmployees, topProblematicSites, topDismantleSites, topInstallationSites] =
      await Promise.allSettled([
        this.routerRepository.getStatistics(input.tenantId),
        this.dashboardService.getSystemSummary({ tenantId: input.tenantId }),
        this.dashboardService.getTopEmployees({ tenantId: input.tenantId, limit: 5 }),
        this.dashboardService.getTopProblematicSites({ tenantId: input.tenantId, limit: 5 }),
        this.dashboardService.getTopDismantleSites({ tenantId: input.tenantId, limit: 5 }),
        this.dashboardService.getTopInstallationSites({ tenantId: input.tenantId, limit: 5 }),
      ]);

    return {
      hero: {
        greeting: `Selamat Datang, ${input.viewerName}!`,
        generatedAtLabel: format(input.now, "EEEE, d MMMM yyyy", { locale: id }),
      },
      overview: mapSettledSection(systemSummary, "Gagal memuat ringkasan sistem"),
      kpis:
        routerStats.status === "fulfilled"
          ? {
              state: "ready",
              data: {
                activeSessions: routerStats.value.totalUserOnline,
                totalRouters: routerStats.value.total,
                onlineRouters: routerStats.value.online,
                offlineRouters: routerStats.value.offline,
              },
            }
          : { state: "error", data: null, message: "Gagal memuat statistik router" },
      leaderboards:
        topEmployees.status === "fulfilled" &&
        topProblematicSites.status === "fulfilled" &&
        topDismantleSites.status === "fulfilled" &&
        topInstallationSites.status === "fulfilled"
          ? {
              state: "ready",
              data: {
                topEmployees: topEmployees.value,
                topProblematicSites: topProblematicSites.value,
                topDismantleSites: topDismantleSites.value,
                topInstallationSites: topInstallationSites.value,
              },
            }
          : { state: "error", data: null, message: "Leaderboard gagal" },
    };
  }
}
```

- [ ] **Step 5: Ubah `DashboardService` dan adapter page service agar tenant context eksplisit**

```ts
async getSystemSummary(input: { tenantId: string }): Promise<SystemSummary>
async getTopEmployees(input: { tenantId: string; limit?: number }): Promise<TopEmployee[]>
async getTopProblematicSites(input: { tenantId: string; limit?: number })
async getTopDismantleSites(input: { tenantId: string; limit?: number })
async getTopInstallationSites(input: { tenantId: string; limit?: number })
```

```ts
import { AdminDashboardComposer } from "./dashboard/AdminDashboardComposer";

export class AdminDashboardPageService {
  private readonly composer = new AdminDashboardComposer();

  async getDashboardData(input: { tenantId: string; viewerName: string; now: Date }) {
    return this.composer.compose(input);
  }
}
```

- [ ] **Step 6: Jalankan ulang test composer admin**

Run: `npm run test:run -- tests/modules/admin/AdminDashboardComposer.test.ts`
Expected: PASS.

## Task 3: Pecah UI admin dan kontrol refresh realtime

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/AdminDashboardClient.tsx`
- Create: `app/admin/_components/AdminDashboardHero.tsx`
- Create: `app/admin/_components/AdminDashboardOverviewSection.tsx`
- Create: `app/admin/_components/AdminDashboardKpiSection.tsx`
- Create: `app/admin/_components/AdminDashboardLeaderboardSection.tsx`
- Modify: `components/dashboard/DashboardSocketUpdate.tsx`
- Test: `tests/components/dashboard/DashboardSocketUpdate.test.tsx`

- [ ] **Step 1: Tulis failing test untuk refresh guard dashboard admin**

```tsx
import { describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
const mockUseRealtimeEvent = vi.fn();
const mockUseRealtimeScope = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: (...args: unknown[]) => mockUseRealtimeEvent(...args),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: (...args: unknown[]) => mockUseRealtimeScope(...args),
}));

import { DashboardSocketUpdate } from "@/components/dashboard/DashboardSocketUpdate";

describe("DashboardSocketUpdate", () => {
  it("throttles repeated realtime refreshes", () => {
    vi.useFakeTimers();

    let onUpdate: (() => void) | undefined;
    mockUseRealtimeEvent.mockImplementation((event: string, handler: () => void) => {
      if (event === "mikrotik.update") onUpdate = handler;
    });

    DashboardSocketUpdate();

    onUpdate?.();
    onUpdate?.();
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    onUpdate?.();
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Jalankan test refresh guard dan pastikan merah**

Run: `npm run test:run -- tests/components/dashboard/DashboardSocketUpdate.test.tsx`
Expected: FAIL karena guard belum ada.

- [ ] **Step 3: Tipiskan page entry admin dan kirim view-model siap render**

```tsx
import { ensureAdminDashboardAccess } from "@/lib/server-auth";
import { AdminDashboardPageService } from "@/modules/admin";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function Page() {
  const access = await ensureAdminDashboardAccess();
  const pageService = new AdminDashboardPageService();
  const viewModel = await pageService.getDashboardData({
    tenantId: access.tenantId,
    viewerName: access.user.name || "Admin",
    now: new Date(),
  });

  return <AdminDashboardClient viewModel={viewModel} />;
}
```

- [ ] **Step 4: Jadikan `AdminDashboardClient` pure presentational dan pecah section component**

```tsx
import { DashboardSocketUpdate } from "@/components/dashboard/DashboardSocketUpdate";
import type { AdminDashboardViewModel } from "@/modules/admin/services/dashboard/admin-dashboard.contracts";
import { AdminDashboardHero } from "./_components/AdminDashboardHero";
import { AdminDashboardOverviewSection } from "./_components/AdminDashboardOverviewSection";
import { AdminDashboardKpiSection } from "./_components/AdminDashboardKpiSection";
import { AdminDashboardLeaderboardSection } from "./_components/AdminDashboardLeaderboardSection";

interface AdminDashboardClientProps {
  viewModel: AdminDashboardViewModel;
}

export function AdminDashboardClient({ viewModel }: AdminDashboardClientProps) {
  return (
    <div className="space-y-8">
      <DashboardSocketUpdate />
      <AdminDashboardHero hero={viewModel.hero} />
      <AdminDashboardOverviewSection section={viewModel.overview} />
      <AdminDashboardKpiSection section={viewModel.kpis} />
      <AdminDashboardLeaderboardSection section={viewModel.leaderboards} />
    </div>
  );
}
```

- [ ] **Step 5: Tambahkan guard refresh ke realtime admin**

```tsx
"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

const ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS = 10_000;

export function DashboardSocketUpdate(): React.ReactElement | null {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useRealtimeScope({ kind: "admin", id: "mikrotik" });

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS) {
      return;
    }

    lastRefreshAtRef.current = now;
    router.refresh();
  }, [router]);

  useRealtimeEvent("mikrotik.update", refresh);
  return null;
}
```

- [ ] **Step 6: Jalankan ulang test admin UI dan composer**

Run: `npm run test:run -- tests/modules/admin/AdminDashboardComposer.test.ts tests/components/dashboard/DashboardSocketUpdate.test.tsx`
Expected: PASS.

## Task 4: Standardisasi route dan service RADIUS

**Files:**
- Create: `modules/network/services/dashboard/radius-dashboard.contracts.ts`
- Create: `modules/network/services/dashboard/radius-dashboard.mapper.ts`
- Create: `modules/network/services/dashboard/RadiusDashboardService.ts`
- Modify: `app/api/admin/radius/dashboard/stats/route.ts`
- Modify: `app/api/admin/radius/dashboard/recent-sessions/route.ts`
- Modify: `app/api/admin/radius/sessions/[username]/history/route.ts`
- Modify: `app/api/admin/radius/sessions/reset/route.ts`
- Test: `tests/modules/network/RadiusDashboardService.test.ts`

- [ ] **Step 1: Tulis failing test untuk shaping stats dan recent sessions RADIUS**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RadiusDashboardService } from "@/modules/network/services/dashboard/RadiusDashboardService";

const mockRepository = {
  getDashboardStats: vi.fn(),
  getRecentSessions: vi.fn(),
  getTotalUsageByUsernames: vi.fn(),
};

describe("RadiusDashboardService", () => {
  beforeEach(() => {
    mockRepository.getDashboardStats.mockResolvedValue({
      totalUsers: 10,
      onlineUsers: 4,
      offlineUsers: 6,
      totalTrafficToday: { download: "10 GB", upload: "1 GB", downloadGB: 10, uploadGB: 1 },
      lastSyncTime: "2026-04-12T08:00:00.000Z",
      lastSyncStats: { created: 1, updated: 2, deleted: 0 },
    });
    mockRepository.getRecentSessions.mockResolvedValue({
      sessions: [
        {
          radAcctId: "acct-1",
          username: "demo-user",
          nasIpAddress: "10.10.10.1",
          framedIpAddress: "172.16.1.10",
          acctStartTime: "2026-04-12T07:00:00.000Z",
          uptimeHours: 1,
          downloadMB: 512,
          uploadMB: 128,
          isOnline: true,
        },
      ],
      total: 1,
    });
    mockRepository.getTotalUsageByUsernames.mockResolvedValue({ "demo-user": 12.5 });
  });

  it("returns a stable stats contract", async () => {
    const service = new RadiusDashboardService(mockRepository as never);
    const result = await service.getStats({ tenantId: "tenant-1" });

    expect(result.totalUsers).toBe(10);
    expect(result.onlineUsers).toBe(4);
  });

  it("returns sessions with pagination and total usage", async () => {
    const service = new RadiusDashboardService(mockRepository as never);
    const result = await service.getRecentSessions({ tenantId: "tenant-1", page: 1, limit: 50, status: "active" });

    expect(result.sessions[0]).toMatchObject({ username: "demo-user", totalUsageGB: 12.5 });
    expect(result.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
  });
});
```

- [ ] **Step 2: Jalankan test service RADIUS dan pastikan merah**

Run: `npm run test:run -- tests/modules/network/RadiusDashboardService.test.ts`
Expected: FAIL karena service dan mapper baru belum ada.

- [ ] **Step 3: Definisikan contract RADIUS dan mapper tipis**

```ts
export interface RadiusDashboardStatsViewModel {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  totalTrafficToday: {
    download: string;
    upload: string;
    downloadGB: number;
    uploadGB: number;
  };
  lastSyncTime: string;
  lastSyncStats: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export interface RadiusRecentSessionsViewModel {
  sessions: Array<{
    radAcctId: string;
    username: string | null;
    nasIpAddress: string;
    framedIpAddress: string | null;
    acctStartTime: string | null;
    uptimeHours: number;
    downloadMB: number;
    uploadMB: number;
    totalUsageGB: number;
    isOnline: boolean;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

- [ ] **Step 4: Implement `RadiusDashboardService`, mapper route, dan tipiskan semua route RADIUS**

```ts
import { RadiusRepository } from "@/modules/network";
import type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionsViewModel,
} from "./radius-dashboard.contracts";

export class RadiusDashboardService {
  constructor(private readonly repository = new RadiusRepository()) {}

  async getStats(input: { tenantId: string }): Promise<RadiusDashboardStatsViewModel> {
    return this.repository.getDashboardStats(input.tenantId);
  }

  async getRecentSessions(input: {
    tenantId: string;
    page: number;
    limit: number;
    status: "active" | "all";
  }): Promise<RadiusRecentSessionsViewModel> {
    const { sessions, total } = await this.repository.getRecentSessions(input.tenantId, input);
    const usernames = sessions
      .map((session) => session.username)
      .filter((username): username is string => Boolean(username));
    const totalUsageByUsername = await this.repository.getTotalUsageByUsernames(input.tenantId, usernames);

    return {
      sessions: sessions.map((session) => ({
        ...session,
        totalUsageGB: totalUsageByUsername[session.username || ""] || 0,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }
}
```

```ts
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { RadiusDashboardService } from "@/modules/network/services/dashboard/RadiusDashboardService";

const radiusDashboardService = new RadiusDashboardService();

export const GET = createHandler({ auth: true, permissions: ["radius:read"] }, async (_req, ctx) => {
  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak valid");

  const data = await radiusDashboardService.getStats({ tenantId });
  return apiSuccess(data);
});
```

```ts
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { RadiusDashboardService } from "@/modules/network/services/dashboard/RadiusDashboardService";

const radiusDashboardService = new RadiusDashboardService();

export const GET = createHandler({ auth: true, permissions: ["radius:read"] }, async (req, ctx) => {
  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak valid");

  const page = Number(req.nextUrl.searchParams.get("page") || "1");
  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");
  const status = req.nextUrl.searchParams.get("status") === "all" ? "all" : "active";

  const data = await radiusDashboardService.getRecentSessions({ tenantId, page, limit, status });
  return apiSuccess(data);
});
```

```ts
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { RadiusSyncService } from "@/modules/network";

const radiusSyncService = new RadiusSyncService();

export const GET = createHandler({ auth: true, permissions: ["radius:read"] }, async (_req, ctx) => {
  const tenantId = ctx.session?.user.tenantId;
  const username = ctx.params.username;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak valid");

  const hasAccess = await radiusSyncService.canGetHistoryForRadiusDashboardUser(username, tenantId);
  if (!hasAccess) return ApiErrors.notFound("Histori user tidak ditemukan");

  const history = await radiusSyncService.getHistoryForRadiusDashboardUser(username, tenantId, {
    page: 1,
    limit: 20,
  });

  return apiSuccess(history);
});
```

```ts
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { RadiusSyncService } from "@/modules/network";

const radiusSyncService = new RadiusSyncService();

export const POST = createHandler({ auth: true, permissions: ["radius:update"] }, async (req, ctx) => {
  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak valid");

  const body = await req.json();
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!username) return ApiErrors.badRequest("Username wajib diisi");

  const result = await radiusSyncService.disconnectSessionByUsername(username, tenantId);
  if (!result.success) {
    return ApiErrors.internalError(result.error || "Gagal reset koneksi");
  }

  return apiSuccess(
    {
      username,
      disconnected: result.disconnected,
      ...(result.pelangganId ? { pelangganId: result.pelangganId } : {}),
    },
    { message: `Reset koneksi ${username} berhasil` },
  );
});
```

- [ ] **Step 5: Jalankan ulang test service RADIUS**

Run: `npm run test:run -- tests/modules/network/RadiusDashboardService.test.ts`
Expected: PASS.

## Task 5: Modularisasi state RADIUS dan coverage behavior-driven

**Files:**
- Create: `app/admin/network/radius/lib/radiusDashboardApi.ts`
- Create: `app/admin/network/radius/lib/radiusDashboardState.ts`
- Create: `app/admin/network/radius/lib/radiusHistoryState.ts`
- Create: `app/admin/network/radius/lib/radiusResetState.ts`
- Modify: `app/admin/network/radius/hooks/useRadiusDashboardData.ts`
- Modify: `app/admin/network/radius/RadiusDashboard.tsx`
- Test: `tests/app/admin/network/radius/radiusDashboardState.test.ts`

- [ ] **Step 1: Tulis failing test untuk state transition dashboard utama RADIUS**

```ts
import { describe, expect, it, vi } from "vitest";
import { DashboardHttpError } from "@/lib/dashboard/fetchDashboardResource";
import { refreshRadiusDashboardState } from "@/app/admin/network/radius/lib/radiusDashboardState";

const previousState = {
  stats: { totalUsers: 10, onlineUsers: 4, offlineUsers: 6, totalTrafficToday: { download: "10 GB", upload: "1 GB", downloadGB: 10, uploadGB: 1 }, lastSyncTime: "2026-04-12T08:00:00.000Z", lastSyncStats: { created: 1, updated: 2, deleted: 0 } },
  sessions: [{ radAcctId: "acct-1", username: "demo-user", nasIpAddress: "10.10.10.1", framedIpAddress: "172.16.1.10", acctStartTime: "2026-04-12T07:00:00.000Z", uptimeHours: 1, downloadMB: 512, uploadMB: 128, isOnline: true }],
  loading: false,
  refreshing: false,
  dashboardError: null,
};

describe("refreshRadiusDashboardState", () => {
  it("stores dashboardError and preserves previous data when main fetch fails", async () => {
    const nextState = await refreshRadiusDashboardState(previousState, {
      fetchStats: vi.fn().mockRejectedValue(new DashboardHttpError("Stats gagal", 500)),
      fetchSessions: vi.fn(),
    });

    expect(nextState.dashboardError).toBe("Stats gagal");
    expect(nextState.stats).toEqual(previousState.stats);
    expect(nextState.sessions).toEqual(previousState.sessions);
  });
});
```

- [ ] **Step 2: Jalankan test state RADIUS dan pastikan merah**

Run: `npm run test:run -- tests/app/admin/network/radius/radiusDashboardState.test.ts`
Expected: FAIL karena state module belum ada.

- [ ] **Step 3: Implement fetcher RADIUS typed dengan `fetchDashboardResource()`**

```ts
import { z } from "zod";
import { fetchDashboardResource } from "@/lib/dashboard/fetchDashboardResource";

export const radiusDashboardStatsSchema = z.object({
  totalUsers: z.number(),
  onlineUsers: z.number(),
  offlineUsers: z.number(),
  totalTrafficToday: z.object({
    download: z.string(),
    upload: z.string(),
    downloadGB: z.number(),
    uploadGB: z.number(),
  }),
  lastSyncTime: z.string(),
  lastSyncStats: z.object({
    created: z.number(),
    updated: z.number(),
    deleted: z.number(),
  }),
});

export async function fetchRadiusDashboardStats() {
  return fetchDashboardResource("/api/admin/radius/dashboard/stats", radiusDashboardStatsSchema);
}
```

- [ ] **Step 4: Implement state modules murni lalu komposisikan ulang hook RADIUS**

```ts
export async function refreshRadiusDashboardState(
  previousState: RadiusDashboardState,
  api: {
    fetchStats: () => Promise<RadiusDashboardStats>;
    fetchSessions: () => Promise<RadiusRecentSessionsViewModel>;
  },
): Promise<RadiusDashboardState> {
  try {
    const [stats, sessions] = await Promise.all([api.fetchStats(), api.fetchSessions()]);

    return {
      ...previousState,
      stats,
      sessions: sessions.sessions,
      loading: false,
      refreshing: false,
      dashboardError: null,
    };
  } catch (error) {
    return {
      ...previousState,
      loading: false,
      refreshing: false,
      dashboardError: error instanceof Error ? error.message : "Gagal memuat dashboard RADIUS",
    };
  }
}
```

```ts
export function useRadiusDashboardData() {
  const dashboard = useRadiusDashboardQuery();
  const history = useRadiusHistoryState();
  const resetAction = useRadiusResetState({ refreshDashboard: dashboard.refresh });

  useRadiusRealtimeBridge({
    applyStatsUpdate: dashboard.applyStatsUpdate,
    applySessionsUpdate: dashboard.applySessionsUpdate,
  });

  return {
    ...dashboard,
    ...history,
    ...resetAction,
  };
}
```

- [ ] **Step 5: Tampilkan error per concern di `RadiusDashboard.tsx`**

```tsx
{dashboardError ? (
  <Alert variant="destructive">{dashboardError}</Alert>
) : null}

{historyError ? (
  <Alert variant="destructive">{historyError}</Alert>
) : null}

{actionError ? (
  <Alert variant="destructive">{actionError}</Alert>
) : null}
```

- [ ] **Step 6: Jalankan ulang test state RADIUS**

Run: `npm run test:run -- tests/app/admin/network/radius/radiusDashboardState.test.ts`
Expected: PASS.

## Task 6: Source of truth billing customer dan contract endpoint baru

**Files:**
- Create: `modules/pelanggan/services/dashboard/customer-dashboard.contracts.ts`
- Create: `modules/pelanggan/services/dashboard/customer-dashboard.mapper.ts`
- Create: `modules/pelanggan/services/dashboard/CustomerDashboardService.ts`
- Modify: `modules/pelanggan/repositories/CustomerInvoiceRepository.ts`
- Create: `app/api/customer/dashboard/summary/route.ts`
- Modify: `app/api/customer/invoices/route.ts`
- Test: `tests/modules/pelanggan/CustomerDashboardService.test.ts`
- Test: `tests/app/api/customer/invoices.route.test.ts`

- [ ] **Step 1: Tulis failing test untuk billing summary customer dan envelope invoices**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerDashboardService } from "@/modules/pelanggan/services/dashboard/CustomerDashboardService";

const mockPortalService = { getProfile: vi.fn() };
const mockUsageService = { getUsageData: vi.fn() };
const mockInvoiceRepository = { getDashboardBillingSummary: vi.fn() };

describe("CustomerDashboardService", () => {
  beforeEach(() => {
    mockPortalService.getProfile.mockResolvedValue({ nama: "Budi", idPelanggan: "P-001", paket: { nama: "30 Mbps", bandwidth: { download: "30 Mbps", upload: "10 Mbps" } } });
    mockUsageService.getUsageData.mockResolvedValue({ connection: { isOnline: true, ipAddress: "10.0.0.1" } });
    mockInvoiceRepository.getDashboardBillingSummary.mockResolvedValue({
      outstandingCount: 2,
      outstandingAmount: 275000,
      nearestDueDate: "2026-04-18T00:00:00.000Z",
      hasOverdue: true,
    });
  });

  it("uses nearest due date and total outstanding from the billing source of truth", async () => {
    const service = new CustomerDashboardService(mockPortalService as never, mockUsageService as never, mockInvoiceRepository as never);
    const result = await service.getDashboardData({ customerId: "cust-1" });

    expect(result.billing.state).toBe("ready");
    expect(result.billing.data).toMatchObject({
      outstandingCount: 2,
      outstandingAmount: 275000,
      nearestDueDate: "2026-04-18T00:00:00.000Z",
      hasOverdue: true,
    });
  });
});
```

```ts
import { expect, it } from "vitest";

it("returns invoices through apiSuccess envelope", async () => {
  const response = await GET(new Request("http://localhost/api/customer/invoices?limit=20") as never);
  const body = await response.json();

  expect(body.success).toBe(true);
  expect(body.data).toHaveProperty("invoices");
  expect(body.data).toHaveProperty("pagination");
});
```

- [ ] **Step 2: Jalankan test customer service dan route invoices**

Run: `npm run test:run -- tests/modules/pelanggan/CustomerDashboardService.test.ts tests/app/api/customer/invoices.route.test.ts`
Expected: FAIL karena service dan contract baru belum ada.

- [ ] **Step 3: Tambahkan query billing summary yang benar di repository invoice**

```ts
async getDashboardBillingSummary(customerId: string) {
  const outstandingInvoices = await prismaBilling.invoice.findMany({
    where: {
      customerId,
      status: { in: ["SENT", "OVERDUE"] },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      status: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
    },
  });

  const outstandingAmount = outstandingInvoices.reduce((total, invoice) => {
    return total + (Number(invoice.totalAmount) - Number(invoice.paidAmount));
  }, 0);

  return {
    outstandingCount: outstandingInvoices.length,
    outstandingAmount,
    nearestDueDate: outstandingInvoices[0]?.dueDate?.toISOString() || null,
    hasOverdue: outstandingInvoices.some((invoice) => invoice.status === "OVERDUE"),
  };
}
```

- [ ] **Step 4: Implement `CustomerDashboardService` dan route summary customer**

```ts
import type { DashboardSection } from "@/lib/dashboard/contracts";
import { CustomerPortalService } from "@/modules/pelanggan/services/CustomerPortalService";
import { CustomerUsageService } from "@/modules/pelanggan/services/CustomerUsageService";
import { CustomerInvoiceRepository } from "@/modules/pelanggan/repositories/CustomerInvoiceRepository";

export class CustomerDashboardService {
  constructor(
    private readonly portalService = new CustomerPortalService(),
    private readonly usageService = new CustomerUsageService(),
    private readonly invoiceRepository = new CustomerInvoiceRepository(),
  ) {}

  async getDashboardData(input: { customerId: string }) {
    const [profileResult, usageResult, billingResult] = await Promise.allSettled([
      this.portalService.getProfile(input.customerId),
      this.usageService.getUsageData(input.customerId),
      this.invoiceRepository.getDashboardBillingSummary(input.customerId),
    ]);

    return {
      profile: profileResult.status === "fulfilled"
        ? { state: "ready", data: profileResult.value }
        : { state: "error", data: null, message: "Gagal memuat profil customer" },
      connection: usageResult.status === "fulfilled"
        ? { state: "ready", data: usageResult.value.connection }
        : { state: "error", data: null, message: "Gagal memuat status koneksi" },
      billing: billingResult.status === "fulfilled"
        ? { state: "ready", data: billingResult.value }
        : { state: "error", data: null, message: "Gagal memuat tagihan customer" },
    };
  }
}
```

```ts
import { apiSuccess } from "@/lib/api";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { CustomerDashboardService } from "@/modules/pelanggan/services/dashboard/CustomerDashboardService";

const customerDashboardService = new CustomerDashboardService();

export async function GET(request: NextRequest) {
  const authResult = await requireCustomerAuth(request);
  if ("response" in authResult) return authResult.response;

  const data = await customerDashboardService.getDashboardData({ customerId: authResult.session.id });
  return apiSuccess(data);
}
```

- [ ] **Step 5: Standardisasi contract route invoices ke `apiSuccess()`**

```ts
return apiSuccess({
  invoices: formattedInvoices,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});
```

- [ ] **Step 6: Jalankan ulang test customer service dan route invoices**

Run: `npm run test:run -- tests/modules/pelanggan/CustomerDashboardService.test.ts tests/app/api/customer/invoices.route.test.ts`
Expected: PASS.

## Task 7: Page-level auth customer dan UI yang fail honestly

**Files:**
- Modify: `lib/customer-auth.ts`
- Modify: `app/(customer)/dashboard/page.tsx`
- Create: `app/(customer)/dashboard/CustomerDashboardClient.tsx`
- Test: `tests/lib/customer-auth-page.test.ts`

- [ ] **Step 1: Tulis failing test untuk helper auth page customer**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn();
const mockGetCustomerSessionFromCookies = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (location: string) => mockRedirect(location),
}));

vi.mock("@/lib/customer-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/customer-auth")>("@/lib/customer-auth");
  return {
    ...actual,
    getCustomerSessionFromCookies: mockGetCustomerSessionFromCookies,
  };
});

import { requireCustomerPageAuth } from "@/lib/customer-auth";

describe("requireCustomerPageAuth", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockGetCustomerSessionFromCookies.mockReset();
  });

  it("redirects guests to /login", async () => {
    mockGetCustomerSessionFromCookies.mockResolvedValue(null);

    await requireCustomerPageAuth();

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("returns the session for active customers", async () => {
    mockGetCustomerSessionFromCookies.mockResolvedValue({ id: "cust-1", status: "AKTIF", nama: "Budi" });

    const result = await requireCustomerPageAuth();

    expect(result.id).toBe("cust-1");
  });
});
```

- [ ] **Step 2: Jalankan test auth page customer dan pastikan merah**

Run: `npm run test:run -- tests/lib/customer-auth-page.test.ts`
Expected: FAIL karena helper page auth belum ada.

- [ ] **Step 3: Implement helper auth page-level untuk dashboard customer**

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_ACCESS_TOKEN_COOKIE } from "@/lib/customer-auth";
import { verifyPelangganAccessToken } from "@/lib/jwt";

export async function getCustomerSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const decoded = verifyPelangganAccessToken(token);
  if (!decoded) return null;

  return {
    id: decoded.id,
    idPelanggan: decoded.idPelanggan,
    nama: decoded.nama,
    username: decoded.username,
    status: decoded.status,
  };
}

export async function requireCustomerPageAuth() {
  const session = await getCustomerSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.status !== "AKTIF") {
    redirect("/login?reason=inactive");
  }

  return session;
}
```

- [ ] **Step 4: Ubah dashboard customer menjadi server entry + client view tunggal**

```tsx
import { requireCustomerPageAuth } from "@/lib/customer-auth";
import { CustomerDashboardClient } from "./CustomerDashboardClient";

export default async function CustomerDashboardPage() {
  const customerSession = await requireCustomerPageAuth();

  return (
    <CustomerDashboardClient
      customerName={customerSession.nama}
      customerId={customerSession.id}
    />
  );
}
```

```tsx
"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { fetchDashboardResource } from "@/lib/dashboard/fetchDashboardResource";

const customerDashboardSchema = z.object({
  profile: z.object({ state: z.enum(["ready", "error"]), data: z.unknown().nullable(), message: z.string().optional() }),
  connection: z.object({ state: z.enum(["ready", "error"]), data: z.unknown().nullable(), message: z.string().optional() }),
  billing: z.object({ state: z.enum(["ready", "error"]), data: z.unknown().nullable(), message: z.string().optional() }),
});

export function CustomerDashboardClient(props: { customerName: string; customerId: string }) {
  const [dashboard, setDashboard] = useState<z.infer<typeof customerDashboardSchema> | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardResource("/api/customer/dashboard/summary", customerDashboardSchema)
      .then(setDashboard)
      .catch((error) => setDashboardError(error instanceof Error ? error.message : "Gagal memuat dashboard customer"));
  }, []);

  if (dashboardError) {
    return <div className="p-6 text-center text-red-600">{dashboardError}</div>;
  }

  if (!dashboard) {
    return <div className="p-6 text-center text-gray-500">Memuat dashboard...</div>;
  }

  return <CustomerDashboardView customerName={props.customerName} dashboard={dashboard} />;
}
```

- [ ] **Step 5: Ganti copy/UI yang menyesatkan dengan state eksplisit**

```tsx
const billingCardLabel =
  dashboard.billing.state === "error"
    ? "Tagihan belum bisa diverifikasi"
    : dashboard.billing.data?.outstandingCount
      ? `Jatuh tempo: ${formatDueDate(dashboard.billing.data.nearestDueDate)}`
      : "Tagihan lunas";

const deviceStatusLabel =
  dashboard.connection.state === "error"
    ? "Status perangkat belum tersedia"
    : dashboard.connection.data?.isOnline
      ? "Aktif & Stabil"
      : "Gangguan / Offline";
```

- [ ] **Step 6: Jalankan ulang test auth page customer**

Run: `npm run test:run -- tests/lib/customer-auth-page.test.ts`
Expected: PASS.

## Task 8: Cleanup fallback lama dan verifikasi akhir

**Files:**
- Modify: `modules/admin/index.ts`
- Modify: `modules/network/index.ts`
- Modify: `modules/pelanggan/index.ts`
- Revisit: semua file yang masih memakai `payload?.data ?? payload`

- [ ] **Step 1: Hapus fallback parsing rapuh dan export public API baru per modul**

```ts
export { AdminDashboardComposer } from "./services/dashboard/AdminDashboardComposer";
export type { AdminDashboardViewModel } from "./services/dashboard/admin-dashboard.contracts";
```

```ts
export { RadiusDashboardService } from "./services/dashboard/RadiusDashboardService";
```

```ts
export { CustomerDashboardService } from "./services/dashboard/CustomerDashboardService";
```

- [ ] **Step 2: Jalankan targeted suite dashboard**

Run: `npm run test:run -- tests/lib/dashboard/fetchDashboardResource.test.ts tests/lib/server-auth-dashboard.test.ts tests/modules/admin/AdminDashboardComposer.test.ts tests/components/dashboard/DashboardSocketUpdate.test.tsx tests/modules/network/RadiusDashboardService.test.ts tests/app/admin/network/radius/radiusDashboardState.test.ts tests/modules/pelanggan/CustomerDashboardService.test.ts tests/app/api/customer/invoices.route.test.ts tests/lib/customer-auth-page.test.ts`
Expected: PASS.

- [ ] **Step 3: Jalankan typecheck penuh**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Jalankan check terpadu sebelum runtime manual**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Start dependency lokal dan aplikasi**

Run: `npm run db:up`
Expected: container database dan Redis aktif.

Run: `npm run dev`
Expected: server lokal aktif di `http://localhost:3000` dengan routing subdomain lokal.

- [ ] **Step 6: Verifikasi runtime untuk tiga dashboard**

Checklist manual:
- Admin: buka `http://admin.localhost:3000/admin`, cek hero/overview/KPI/leaderboard tampil dan section error muncul jujur bila source tertentu dimatikan.
- RADIUS: buka `http://admin.localhost:3000/admin/network/radius`, cek load awal, refresh manual, history modal, reset action, dan event realtime tidak menimpa state invalid.
- Customer: buka `http://pelanggan.localhost:3000/dashboard`, cek auth redirect, billing summary memakai due date yang benar, dan error section tidak tampil sebagai status “Normal” atau “Lunas”.

- [ ] **Step 7: Verifikasi fallback lama benar-benar hilang dari caller dashboard**

Run: `rg "payload\?\.data \?\? payload|profileJson\.data\?\.profile \|\| profileJson\.profile|usageJson\.data\?\.connection \|\| usageJson\.connection" app modules tests`
Expected: tidak ada caller dashboard aktif yang masih menebak format response.
