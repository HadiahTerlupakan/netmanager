import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TargetEntity } from "@/modules/presurvei";

/**
 * `POST /api/admin/presurvei/target` menurunkan tenant baris dari sesi —
 * bukan dari body — lalu menyerahkannya ke `TargetService.tetapkan`, yang
 * memvalidasi bahwa sales-nya sales se-tenant. Super admin tanpa tenant sesi
 * tidak ditolak (keputusan user 2026-09-23); ia meneruskan null dan service
 * memakai tenant milik sales itu sendiri.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  tetapkan: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/presurvei", async () => {
  const actual = await vi.importActual<typeof import("@/modules/presurvei")>(
    "@/modules/presurvei",
  );

  return {
    ...actual,
    TargetService: class {
      tetapkan = mockFns.tetapkan;
    },
  };
});

import { POST } from "@/app/api/admin/presurvei/target/route";

const targetTersimpan: TargetEntity = {
  id: "target-1",
  userId: "sales-1",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 5,
  tenantId: "tenant-sesi",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

const bodi = {
  userId: "sales-1",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 5,
};

const sesi = (user: { tenantId?: string; isSuperAdmin?: boolean }): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "admin-1",
      email: "admin@contoh.id",
      permissions: ["presurvei_target:create"],
      ...user,
    },
  });
};

const mintaTetapkan = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/admin/presurvei/target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never,
  );

describe("POST /api/admin/presurvei/target — tenant baris", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.tetapkan.mockResolvedValue(targetTersimpan);
  });

  it("meneruskan tenant sesi ke service", async () => {
    sesi({ tenantId: "tenant-sesi" });

    const respons = await mintaTetapkan(bodi);

    expect(respons.status).toBe(201);
    expect(mockFns.tetapkan).toHaveBeenCalledWith(bodi, "tenant-sesi");
  });

  it("mengabaikan tenantId kiriman body", async () => {
    sesi({ tenantId: "tenant-sesi" });

    await mintaTetapkan({ ...bodi, tenantId: "tenant-lain" });

    expect(mockFns.tetapkan).toHaveBeenCalledWith(bodi, "tenant-sesi");
  });

  it("meneruskan null untuk super admin tanpa tenant sesi, alih-alih menolak", async () => {
    sesi({ isSuperAdmin: true });

    const respons = await mintaTetapkan(bodi);

    expect(respons.status).toBe(201);
    expect(mockFns.tetapkan).toHaveBeenCalledWith(bodi, null);
  });

  it("menolak 400 pemanggil biasa tanpa tenant sesi", async () => {
    sesi({});

    const respons = await mintaTetapkan(bodi);

    expect(respons.status).toBe(400);
    expect(mockFns.tetapkan).not.toHaveBeenCalled();
  });
});
