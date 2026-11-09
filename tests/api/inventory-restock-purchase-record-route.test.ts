import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  hasPermission: vi.fn(),
  ensureSiteAccess: vi.fn(),
  recordPurchase: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
}));
vi.mock("@/app/api/inventory/restock/_lib/restock-site-access", () => ({
  ensureRestockRequestSiteAccess: mocks.ensureSiteAccess,
  ensureRestockGudangSiteAccess: vi.fn(),
}));
vi.mock("@/modules/inventory", async () => {
  const messages = await vi.importActual<
    typeof import("@/modules/inventory/services/restock-messages")
  >("@/modules/inventory/services/restock-messages");
  return {
    ...messages,
    createRestockPurchaseRecordService: vi.fn(() => ({
      recordPurchase: mocks.recordPurchase,
    })),
  };
});

import { POST } from "@/app/api/inventory/restock/requests/[id]/purchases/route";

const ROUTE_PATH = "app/api/inventory/restock/requests/[id]/purchases/route.ts";

const validBody = {
  storeName: "  Toko Sinar  ",
  purchasedAt: "2026-11-09",
  notes: "   ",
  items: [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: 12000 }],
};

function post(body: unknown) {
  return POST(
    new NextRequest(
      "http://localhost/api/inventory/restock/requests/pr-1/purchases",
      {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: "pr-1" }) },
  );
}

describe("POST /api/inventory/restock/requests/[id]/purchases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Sari",
        tenantId: "tenant-1",
        permissions: [],
      },
    });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.ensureSiteAccess.mockResolvedValue(null);
  });

  it("403 tanpa izin restock:verify", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:verify");
    expect(mocks.recordPurchase).not.toHaveBeenCalled();
  });

  it("400 bila body tidak terbaca", async () => {
    const response = await post("{bukan json");

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("tidak terbaca");
  });

  it("400 dengan posisi baris bila isian barang salah", async () => {
    const response = await post({
      ...validBody,
      items: [
        { purchaseOrderItemId: "poi-1", quantity: 1 },
        { purchaseOrderItemId: "poi-2", quantity: 1.5 },
      ],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Barang ke-2: Jumlah dibeli harus angka bulat, tanpa koma.",
    );
  });

  it("400 bila barang yang sama tercantum dua kali", async () => {
    const response = await post({
      ...validBody,
      items: [
        { purchaseOrderItemId: "poi-1", quantity: 1 },
        { purchaseOrderItemId: "poi-1", quantity: 2 },
      ],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Barang ke-2: Barang ini tercantum dua kali. Hapus salah satunya.",
    );
  });

  it("201 dengan isian yang sudah dirapikan", async () => {
    const record = {
      id: "rec-1",
      storeName: "Toko Sinar",
      items: [] as unknown[],
    };
    mocks.recordPurchase.mockResolvedValue({
      success: true,
      data: {
        record,
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: false,
        message: "Tersimpan. Belanja di Toko Sinar sudah dicatat.",
      },
    });

    const response = await post(validBody);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: record,
      purchaseOrderStatus: "ORDERED",
      isFullyPurchased: false,
      message: "Tersimpan. Belanja di Toko Sinar sudah dicatat.",
    });
    expect(mocks.recordPurchase).toHaveBeenCalledWith({
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
      origin: {
        kind: "ADMIN",
        actorId: "user-1",
        buyerName: null,
        actorName: "Sari",
      },
      storeName: "Toko Sinar",
      supplierId: null,
      purchasedAt: "2026-11-09",
      notes: null,
      fotoNota: [],
      items: [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: 12000 }],
    });
  });

  it("meneruskan nama pembeli isian admin (spasi dirapikan)", async () => {
    mocks.recordPurchase.mockResolvedValue({
      success: true,
      data: {
        record: { id: "rec-1" },
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: false,
        message: "ok",
        isReplay: false,
      },
    });

    await post({ ...validBody, buyerName: "  Pak   Joko " });

    expect(mocks.recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: {
          kind: "ADMIN",
          actorId: "user-1",
          buyerName: "Pak Joko",
          actorName: "Sari",
        },
      }),
    );
  });

  it.each([
    ["INVALID", 400],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
  ])("memetakan %s ke %i", async (code, status) => {
    mocks.recordPurchase.mockResolvedValue({
      success: false,
      code,
      error: "Pesan untuk petugas tidak ditemukan",
    });

    const response = await post(validBody);

    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(
      "Pesan untuk petugas tidak ditemukan",
    );
  });

  it("500 dan dicatat bila ada galat tak terduga", async () => {
    mocks.recordPurchase.mockRejectedValue(new Error("db mati"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Mencatat belanja");
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("tidak mengimpor Repository atau Prisma langsung", () => {
    const source = readFileSync(join(process.cwd(), ROUTE_PATH), "utf8");

    expect(source).not.toMatch(/Repository|@prisma\/client|prisma\./);
  });
});
