import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  userFindFirst: vi.fn(),
  mitraFindUnique: vi.fn(),
  gudangFindMany: vi.fn(),
  gudangFindFirst: vi.fn(),
  barangFindMany: vi.fn(),
  barangGudangFindMany: vi.fn(),
  barangGudangFindFirst: vi.fn(),
  barangMasukFindMany: vi.fn(),
  barangKeluarFindMany: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: mockFns.userFindFirst,
    },
    gudang: {
      findMany: mockFns.gudangFindMany,
      findFirst: mockFns.gudangFindFirst,
    },
    barang: {
      findMany: mockFns.barangFindMany,
    },
    barangGudang: {
      findMany: mockFns.barangGudangFindMany,
      findFirst: mockFns.barangGudangFindFirst,
    },
    barangMasuk: {
      findMany: mockFns.barangMasukFindMany,
    },
    barangKeluar: {
      findMany: mockFns.barangKeluarFindMany,
    },
  },
  prismaMitra: {
    mitra: {
      findUnique: mockFns.mitraFindUnique,
    },
  },
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ErrorCodes: {
    FORBIDDEN: "FORBIDDEN",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { GET as getGudang } from "@/app/api/mobile/inventory/gudang/route";
import { GET as getBarang } from "@/app/api/mobile/inventory/barang/route";
import { GET as getRiwayat } from "@/app/api/mobile/inventory/riwayat/route";
import { POST as postMasuk } from "@/app/api/mobile/inventory/masuk/route";
import { POST as postKeluar } from "@/app/api/mobile/inventory/keluar/route";

describe("mobile inventory authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects gudang access without inventory capability", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_dashboard:read"],
    });

    const response = await getGudang(
      new NextRequest("http://localhost/api/mobile/inventory/gudang"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses inventory ditolak");
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects barang keluar access without outgoing inventory permission", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_dashboard:read"],
    });

    const response = await getBarang(
      new NextRequest(
        "http://localhost/api/mobile/inventory/barang?gudangId=g-1&mode=keluar",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses inventory ditolak");
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects riwayat access without read permission", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_dashboard:read"],
    });

    const response = await getRiwayat(
      new NextRequest("http://localhost/api/mobile/inventory/riwayat"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses inventory ditolak");
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects barang masuk mutation without create permission", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_barang:read"],
    });

    const response = await postMasuk(
      new NextRequest("http://localhost/api/mobile/inventory/masuk", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses inventory masuk ditolak");
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects barang keluar mutation without create permission", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      permissions: ["m_barang:read"],
    });

    const response = await postKeluar(
      new NextRequest("http://localhost/api/mobile/inventory/keluar", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses inventory keluar ditolak");
    expect(mockFns.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects mitra inventory masuk mutation while persistence is user-only", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang_masuk:create"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });

    const response = await postMasuk(
      new NextRequest("http://localhost/api/mobile/inventory/masuk", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Mutasi inventory untuk mitra belum tersedia");
  });

  it("rejects mitra inventory keluar mutation while persistence is user-only", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang_keluar:create"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });

    const response = await postKeluar(
      new NextRequest("http://localhost/api/mobile/inventory/keluar", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Mutasi inventory untuk mitra belum tersedia");
  });

  it("rejects mitra inventory history while history remains user-bound", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang:read", "m_barang_masuk:read"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });

    const response = await getRiwayat(
      new NextRequest("http://localhost/api/mobile/inventory/riwayat"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Riwayat inventory untuk mitra belum tersedia");
  });
});
