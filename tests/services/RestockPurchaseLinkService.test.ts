import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import { hashLinkToken } from "@/lib/security/link-token";
import type { RestockPurchaseContext } from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import { RestockPurchaseLinkService } from "@/modules/inventory/services/RestockPurchaseLinkService";

const NOW = new Date("2026-11-09T03:00:00Z");
const summary = {
  id: "link-1",
  createdAt: NOW,
  expiresAt: new Date("2026-12-09T03:00:00Z"),
  lastUsedAt: null as Date | null,
  createdByName: "Sari",
};

function context(
  status = "ORDERED",
  purchasedQuantity = 0,
  linkedRequestCount = 1,
): RestockPurchaseContext {
  return {
    request: {
      id: "pr-1",
      nomorRequest: "PR-001",
      status,
      purchaseOrderId: "po-1",
      receivableBarangIds: ["barang-1"],
    },
    purchaseOrder: {
      id: "po-1",
      poNumber: "PO-1",
      status: "ORDERED",
      tenantId: "tenant-1",
      linkedRequestCount,
      isLegacyPurchased: false,
      items: [
        {
          id: "poi-1",
          barangId: "barang-1",
          quantity: 10,
          cancelledQuantity: 0,
          receivedQuantity: 0,
          purchasedQuantity,
          barang: { nama: "Kabel", satuan: "roll" },
        },
      ],
    },
  };
}

function setup() {
  const links = {
    findByTokenHash: vi.fn(),
    findActiveForRequest: vi.fn().mockResolvedValue(summary),
    replaceActiveLink: vi.fn().mockResolvedValue(summary),
    revokeActiveLinks: vi.fn().mockResolvedValue(1),
    touchLastUsed: vi.fn(),
    findPublicListSource: vi.fn(),
  };
  const records = { findPurchaseContext: vi.fn().mockResolvedValue(context()) };
  const storage = { isAvailable: vi.fn().mockResolvedValue(true) };
  const service = new RestockPurchaseLinkService(
    links,
    records,
    storage,
    () => NOW,
  );
  return { links, records, storage, service };
}

describe("RestockPurchaseLinkService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create mengembalikan token yang hash-nya disimpan, berlaku 30 hari", async () => {
    const { links, service } = setup();

    const result = await service.create("pr-1", "tenant-1", "admin-1");

    expect(result.success).toBe(true);
    if (result.success !== true) return;
    const stored = links.replaceActiveLink.mock.calls[0][0];
    expect(stored.tokenHash).toBe(hashLinkToken(result.data.token));
    expect(stored.tokenHash).not.toBe(result.data.token);
    expect(stored.expiresAt.toISOString()).toBe("2026-12-09T03:00:00.000Z");
    expect(stored).toMatchObject({
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
      createdById: "admin-1",
    });
  });

  it("log pembuatan link tanpa token maupun hash", async () => {
    const { links, service } = setup();

    const result = await service.create("pr-1", "tenant-1", "admin-1");
    if (result.success !== true) throw new Error("gagal");

    const entry = logActivitySafe.mock.calls[0][0];
    expect(entry).toMatchObject({
      action: "CREATE_PURCHASE_LINK",
      subject: "Pengajuan Restock PR-001",
      userId: "admin-1",
      details: { linkId: "link-1" },
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(result.data.token);
    expect(serialized).not.toContain(
      links.replaceActiveLink.mock.calls[0][0].tokenHash,
    );
  });

  it.each([
    ["NOT_APPROVED", context("SUBMITTED"), true],
    ["CLOSED", context("CANCELLED"), true],
    ["ALL_PURCHASED", context("ORDERED", 10), true],
    ["MERGED_ORDER", context("ORDERED", 0, 2), true],
    ["STORAGE_OFF", context(), false],
  ])("create ditolak saat %s", async (_label, ctx, isStorageAvailable) => {
    const { links, records, storage, service } = setup();
    records.findPurchaseContext.mockResolvedValue(ctx);
    storage.isAvailable.mockResolvedValue(isStorageAvailable);

    const result = await service.create("pr-1", "tenant-1", "admin-1");

    expect(result).toMatchObject({ success: false, code: "UNAVAILABLE" });
    expect(links.replaceActiveLink).not.toHaveBeenCalled();
  });

  it("create NOT_FOUND bila pengajuan tidak ada", async () => {
    const { records, service } = setup();
    records.findPurchaseContext.mockResolvedValue(null);

    expect(await service.create("pr-x", "tenant-1", "admin-1")).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it.each([
    ["ALL_PURCHASED", context("ORDERED", 10), true],
    ["CLOSED", context("RECEIVED"), true],
    ["STORAGE_OFF", context(), false],
    ["MERGED_ORDER", context("ORDERED", 0, 2), true],
  ])(
    "getStatus tetap menampilkan link aktif saat %s supaya bisa dimatikan",
    async (availability, ctx, isStorageAvailable) => {
      const { links, records, storage, service } = setup();
      records.findPurchaseContext.mockResolvedValue(ctx);
      storage.isAvailable.mockResolvedValue(isStorageAvailable);

      const result = await service.getStatus("pr-1", "tenant-1");

      expect(result).toEqual({
        success: true,
        data: { link: summary, availability },
      });
      expect(links.findActiveForRequest).toHaveBeenCalledWith(
        "pr-1",
        "tenant-1",
        NOW,
      );
    },
  );

  it("getStatus tanpa link aktif mengembalikan null", async () => {
    const { links, records, service } = setup();
    records.findPurchaseContext.mockResolvedValue(context("ORDERED", 10));
    links.findActiveForRequest.mockResolvedValue(null);

    expect(await service.getStatus("pr-1", "tenant-1")).toEqual({
      success: true,
      data: { link: null, availability: "ALL_PURCHASED" },
    });
  });

  it("create ditolak untuk pesanan gabungan dengan pesan awam", async () => {
    const { records, service } = setup();
    records.findPurchaseContext.mockResolvedValue(context("ORDERED", 0, 2));

    expect(await service.create("pr-1", "tenant-1", "admin-1")).toEqual({
      success: false,
      code: "UNAVAILABLE",
      error:
        "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi link belanja tidak bisa dipakai dan belanjanya tidak dicatat. Statusnya mengikuti barang yang datang.",
    });
  });

  it("getStatus menampilkan link aktif saat tersedia", async () => {
    const { service } = setup();

    expect(await service.getStatus("pr-1", "tenant-1")).toEqual({
      success: true,
      data: { link: summary, availability: "AVAILABLE" },
    });
  });

  it("revoke mencabut dan mencatat log", async () => {
    const { links, service } = setup();

    const result = await service.revoke("pr-1", "tenant-1", "admin-2");

    expect(result).toEqual({ success: true, data: { revoked: true } });
    expect(links.revokeActiveLinks).toHaveBeenCalledWith(
      "pr-1",
      "tenant-1",
      "admin-2",
      NOW,
    );
    expect(logActivitySafe.mock.calls[0][0].action).toBe(
      "REVOKE_PURCHASE_LINK",
    );
  });

  it("revoke tanpa link aktif tidak mencatat log", async () => {
    const { links, service } = setup();
    links.revokeActiveLinks.mockResolvedValue(0);

    expect(await service.revoke("pr-1", "tenant-1", "admin-2")).toEqual({
      success: true,
      data: { revoked: false },
    });
    expect(logActivitySafe).not.toHaveBeenCalled();
  });
});
