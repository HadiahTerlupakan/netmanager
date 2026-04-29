import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFns, MockInventoryRepository } = vi.hoisted(() => {
  const mockFns = {
    getMobileAuthPayload: vi.fn(),
    userFindFirst: vi.fn(),
    mitraFindUnique: vi.fn(),
    workOrderFindFirst: vi.fn(),
    gudangFindMany: vi.fn(),
    gudangFindFirst: vi.fn(),
    barangFindMany: vi.fn(),
    barangGudangFindMany: vi.fn(),
    barangGudangFindFirst: vi.fn(),
    barangMasukFindMany: vi.fn(),
    barangKeluarFindMany: vi.fn(),
    inventoryAddStock: vi.fn(),
    inventoryRemoveStock: vi.fn(),
    inventoryGetStockLevel: vi.fn(),
    loggerLogActivity: vi.fn(),
    socketInventoryUpdate: vi.fn(),
  };

  class MockInventoryRepository {
    findMobileActorUser = (input: { actorId: string; tenantId: string }) =>
      mockFns.userFindFirst({
        where: { id: input.actorId, tenantId: input.tenantId },
        include: {
          role: { include: { permission: true } },
          sites: true,
          userSites: { select: { siteId: true } },
        },
      });
    findMobileActorMitra = (actorId: string) =>
      mockFns.mitraFindUnique({
        where: { id: actorId },
        select: { id: true, siteId: true },
      });
    findMobileGudangs = (input: { tenantId: string; siteIds?: string[] }) =>
      mockFns.gudangFindMany({
        where: {
          isActive: true,
          tenantId: input.tenantId,
          ...(input.siteIds
            ? { sites: { some: { id: { in: input.siteIds } } } }
            : {}),
        },
        select: { id: true, kode: true, nama: true, lokasi: true },
        orderBy: { nama: "asc" },
      });
    findMobileBarangForMasuk = (input: {
      tenantId: string;
      siteIds?: string[];
    }) =>
      mockFns.barangFindMany({
        where: {
          tenantId: input.tenantId,
          ...(input.siteIds
            ? {
                barangGudang: {
                  some: {
                    gudang: { sites: { some: { id: { in: input.siteIds } } } },
                  },
                },
              }
            : {}),
        },
      });
    findMobileBarangForKeluar = (input: {
      tenantId: string;
      gudangId: string;
      siteIds?: string[];
    }) =>
      mockFns.barangGudangFindMany({
        where: {
          gudangId: input.gudangId,
          tenantId: input.tenantId,
          ...(input.siteIds
            ? { gudang: { sites: { some: { id: { in: input.siteIds } } } } }
            : {}),
        },
      });
    findMobileGudangSites = (input: { gudangId: string; tenantId: string }) =>
      mockFns.gudangFindFirst({
        where: { id: input.gudangId, tenantId: input.tenantId },
        select: { id: true, sites: { select: { id: true } } },
      });
    findMobileBarangGudangStock = (input: {
      barangId: string;
      gudangId: string;
      tenantId: string;
    }) =>
      mockFns.barangGudangFindFirst({
        where: {
          barangId: input.barangId,
          gudangId: input.gudangId,
          tenantId: input.tenantId,
        },
        include: { barang: { select: { nama: true } } },
      });
    findMobileHistoryMasuk = (input: {
      where: Record<string, unknown>;
      take: number;
    }) =>
      mockFns.barangMasukFindMany({
        where: input.where,
        include: {
          barang: { select: { kode: true, nama: true, satuan: true } },
          gudang: { select: { nama: true } },
        },
        orderBy: { tanggal: "desc" },
        take: input.take,
      });
    findMobileHistoryKeluar = (input: {
      where: Record<string, unknown>;
      take: number;
    }) =>
      mockFns.barangKeluarFindMany({
        where: input.where,
        include: {
          barang: { select: { kode: true, nama: true, satuan: true } },
          gudang: { select: { nama: true } },
        },
        orderBy: { tanggal: "desc" },
        take: input.take,
      });
    addStock = (...args: unknown[]) => mockFns.inventoryAddStock(...args);
    removeStock = (...args: unknown[]) => mockFns.inventoryRemoveStock(...args);
    getStockLevel = (...args: unknown[]) =>
      mockFns.inventoryGetStockLevel(...args);
  }

  return { mockFns, MockInventoryRepository };
});

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: mockFns.userFindFirst,
    },
    workOrders: {
      findFirst: mockFns.workOrderFindFirst,
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

vi.mock("@/modules/inventory/repositories/InventoryRepository", () => ({
  InventoryRepository: MockInventoryRepository,
}));

vi.mock("@/modules/inventory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/inventory")>();

  return {
    ...actual,
    InventoryRepository: MockInventoryRepository,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: (...args: unknown[]) => mockFns.loggerLogActivity(...args),
  },
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    inventoryUpdate: (...args: unknown[]) =>
      mockFns.socketInventoryUpdate(...args),
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
      userId: "user-1",
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
      userId: "user-1",
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
      userId: "user-1",
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
      userId: "user-1",
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
      userId: "user-1",
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

  it("allows mitra inventory masuk mutation via actor-aware repository flow", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      userId: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang_masuk:create"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });
    mockFns.gudangFindFirst.mockResolvedValue({
      id: "g-1",
      sites: [{ id: "site-1" }],
    });
    mockFns.inventoryAddStock.mockResolvedValue({ id: "masuk-1" });

    const response = await postMasuk(
      new NextRequest("http://localhost/api/mobile/inventory/masuk", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockFns.inventoryAddStock).toHaveBeenCalledWith(
      expect.objectContaining({
        barangId: "b-1",
        gudangId: "g-1",
        jumlah: 1,
        actor: { type: "mitra", id: "mitra-1" },
        tenantId: "tenant-1",
      }),
    );
  });

  it("keeps gudang read site-filtered for mitra actors", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-2",
      userId: "mitra-2",
      tenantId: "tenant-1",
      permissions: ["m_barang:read"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-2",
      siteId: "site-2",
    });
    mockFns.gudangFindMany.mockResolvedValue([{ id: "g-2", nama: "Gudang B" }]);

    const response = await getGudang(
      new NextRequest("http://localhost/api/mobile/inventory/gudang"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.gudangList).toHaveLength(1);
    expect(mockFns.gudangFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          sites: {
            some: {
              id: { in: ["site-2"] },
            },
          },
        }),
      }),
    );
  });

  it("does not widen restricted gudang access from work order site", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-3",
      userId: "user-3",
      tenantId: "tenant-1",
      permissions: ["m_barang:read"],
    });
    mockFns.userFindFirst.mockResolvedValue({
      id: "user-3",
      role: {
        name: "OPERATOR",
        permission: [{ resource: "k_barang", action: "site_only" }],
      },
      sites: { id: "site-1" },
      userSites: [{ siteId: "site-1" }],
    });
    mockFns.workOrderFindFirst.mockResolvedValue({ siteId: "site-2" });
    mockFns.gudangFindMany.mockResolvedValue([{ id: "g-1", nama: "Gudang A" }]);

    const response = await getGudang(
      new NextRequest(
        "http://localhost/api/mobile/inventory/gudang?workOrderId=wo-1",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.gudangList).toHaveLength(1);
    expect(mockFns.gudangFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          sites: {
            some: {
              id: { in: ["site-1"] },
            },
          },
        }),
      }),
    );
    expect(mockFns.gudangFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sites: {
            some: {
              id: { in: ["site-1", "site-2"] },
            },
          },
        }),
      }),
    );
  });

  it("keeps barang read site-filtered for user actors", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-2",
      userId: "user-2",
      tenantId: "tenant-1",
      permissions: ["m_barang:read"],
    });
    mockFns.userFindFirst.mockResolvedValue({
      id: "user-2",
      role: {
        name: "OPERATOR",
        permission: [{ resource: "k_barang", action: "site_only" }],
      },
      sites: { id: "site-1" },
      userSites: [{ siteId: "site-3" }],
    });
    mockFns.barangGudangFindMany.mockResolvedValue([
      {
        barang: {
          id: "b-1",
          kode: "BRG-1",
          nama: "Router",
          satuan: "unit",
          isWorkOrderMaterial: false,
        },
        stok: 4,
        stokBaru: 4,
        stokBekas: 0,
        stokRusak: 0,
      },
    ]);

    const response = await getBarang(
      new NextRequest(
        "http://localhost/api/mobile/inventory/barang?gudangId=g-1&mode=keluar",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.barangList).toHaveLength(1);
    expect(mockFns.barangGudangFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gudangId: "g-1",
          tenantId: "tenant-1",
          gudang: {
            sites: {
              some: {
                id: { in: ["site-3", "site-1"] },
              },
            },
          },
        }),
      }),
    );
  });

  it("allows mitra inventory keluar mutation via actor-aware repository flow", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      userId: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang_keluar:create"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });
    mockFns.gudangFindFirst.mockResolvedValue({
      id: "g-1",
      sites: [{ id: "site-1" }],
    });
    mockFns.barangGudangFindFirst.mockResolvedValue({
      stokBaru: 3,
      barang: { nama: "ONU" },
    });
    mockFns.inventoryRemoveStock.mockResolvedValue({ id: "keluar-1" });
    mockFns.inventoryGetStockLevel.mockResolvedValue(2);
    mockFns.loggerLogActivity.mockResolvedValue(undefined);

    const response = await postKeluar(
      new NextRequest("http://localhost/api/mobile/inventory/keluar", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockFns.inventoryRemoveStock).toHaveBeenCalledWith(
      expect.objectContaining({
        barangId: "b-1",
        gudangId: "g-1",
        jumlah: 1,
        actor: { type: "mitra", id: "mitra-1" },
        tenantId: "tenant-1",
      }),
    );
    expect(mockFns.socketInventoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "keluar",
        userId: "mitra-1",
        barangId: "b-1",
        gudangId: "g-1",
        jumlah: 1,
        totalStok: 2,
      }),
    );
    expect(mockFns.loggerLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: "mitra", id: "mitra-1" },
        tenantId: "tenant-1",
      }),
    );
  });

  it("allows bare-feature permission for barang keluar", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-2",
      userId: "mitra-2",
      tenantId: "tenant-1",
      permissions: ["m_barang_keluar"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-2",
      siteId: "site-1",
    });
    mockFns.gudangFindFirst.mockResolvedValue({
      id: "g-1",
      sites: [{ id: "site-1" }],
    });
    mockFns.barangGudangFindFirst.mockResolvedValue({
      stokBaru: 3,
      barang: { nama: "ONU" },
    });
    mockFns.inventoryRemoveStock.mockResolvedValue({ id: "keluar-2" });
    mockFns.inventoryGetStockLevel.mockResolvedValue(2);
    mockFns.loggerLogActivity.mockResolvedValue(undefined);

    const response = await postKeluar(
      new NextRequest("http://localhost/api/mobile/inventory/keluar", {
        method: "POST",
        body: JSON.stringify({ barangId: "b-1", gudangId: "g-1", jumlah: 1 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.inventoryRemoveStock).toHaveBeenCalledTimes(1);
  });

  it("allows mitra inventory history with actor-aware filters", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      userId: "mitra-1",
      tenantId: "tenant-1",
      permissions: ["m_barang"],
    });
    mockFns.userFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });
    mockFns.barangMasukFindMany.mockResolvedValue([
      {
        id: "masuk-1",
        barang: { kode: "BRG-1", nama: "ONU", satuan: "pcs" },
        gudang: { nama: "Gudang A" },
        jumlah: 1,
        kondisi: "BARU",
        keterangan: "restock",
        tanggal: new Date("2026-04-16T10:00:00.000Z"),
      },
    ]);
    mockFns.barangKeluarFindMany.mockResolvedValue([]);

    const response = await getRiwayat(
      new NextRequest("http://localhost/api/mobile/inventory/riwayat"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(mockFns.barangMasukFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          actorType: "mitra",
          actorId: "mitra-1",
          gudang: {
            sites: {
              some: {
                id: { in: ["site-1"] },
              },
            },
          },
        }),
      }),
    );
  });
});
