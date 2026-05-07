import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdmin,
  mockBarangMasukGroupBy,
  mockBarangKeluarGroupBy,
  mockBarangGudangFindUnique,
  mockBarangFindUnique,
  mockGudangFindUnique,
  mockLoggerDbOperation,
  mockLoggerApiRequest,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockBarangMasukGroupBy: vi.fn(),
  mockBarangKeluarGroupBy: vi.fn(),
  mockBarangGudangFindUnique: vi.fn(),
  mockBarangFindUnique: vi.fn(),
  mockGudangFindUnique: vi.fn(),
  mockLoggerDbOperation: vi.fn(),
  mockLoggerApiRequest: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (request: NextRequest) => mockRequireAdmin(request),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    barangMasuk: {
      groupBy: (...args: unknown[]) => mockBarangMasukGroupBy(...args),
    },
    barangKeluar: {
      groupBy: (...args: unknown[]) => mockBarangKeluarGroupBy(...args),
    },
    barangGudang: {
      findUnique: (...args: unknown[]) => mockBarangGudangFindUnique(...args),
    },
    barang: {
      findUnique: (...args: unknown[]) => mockBarangFindUnique(...args),
    },
    gudang: {
      findUnique: (...args: unknown[]) => mockGudangFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: (...args: unknown[]) => mockLoggerApiRequest(...args),
    dbOperation: (...args: unknown[]) => mockLoggerDbOperation(...args),
  },
}));

import { GET } from "@/app/api/inventory/barang/stock/by-kondisi/route";

describe("GET /api/inventory/barang/stock/by-kondisi", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mockBarangMasukGroupBy.mockResolvedValue([
      { kondisi: "BARU", _sum: { jumlah: 1 } },
    ]);
    mockBarangKeluarGroupBy.mockResolvedValue([
      { kondisi: "BARU", _sum: { jumlah: 1400 } },
    ]);
    mockBarangGudangFindUnique.mockResolvedValue({
      stok: 1,
      stokBaru: 1,
      stokBekas: 0,
      stokRusak: 0,
    });
    mockBarangFindUnique.mockResolvedValue({
      id: "barang-1",
      kode: "BRG-001",
      nama: "Modem",
      satuan: "pcs",
    });
    mockGudangFindUnique.mockResolvedValue({
      id: "gudang-1",
      kode: "GD-001",
      nama: "Gudang Utama",
    });
  });

  it("does not return negative stock per kondisi when historical logs drift below zero", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/inventory/barang/stock/by-kondisi?barangId=barang-1&gudangId=gudang-1",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.stockPerKondisi).toEqual({
      BARU: 1,
      BEKAS: 0,
      RUSAK: 0,
    });
    expect(json.data.totalStock).toBe(1);
  });
});
