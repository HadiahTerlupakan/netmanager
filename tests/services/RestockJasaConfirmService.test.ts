import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { confirmRestockJasaItems } from "@/modules/inventory/services/RestockJasaConfirmService";
import { prismaMock } from "@/tests/setup";

vi.mock("@/lib/logger", () => ({
  logger: { logActivity: vi.fn(), error: vi.fn() },
}));

const NOT_REJECTED = { statusApproval: { not: "REJECTED" } };

// `MockPrismaClient` belum mengetik model ini, padahal mock-nya tersedia.
const jasaItemMock = (
  prismaMock as unknown as {
    purchaseRequestJasaItem: { update: Mock; count: Mock };
  }
).purchaseRequestJasaItem;

describe("confirmRestockJasaItems — baris jasa yang ditolak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
      (callback as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock),
    );
  });

  it("hanya memuat jasa dan barang yang tidak ditolak", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue(null);

    await confirmRestockJasaItems({
      purchaseRequestId: "pr-1",
      items: [{ jasaItemId: "jasa-1", buktiSelesai: ["foto.jpg"] }],
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    const [query] = prismaMock.purchaseRequest.findFirst.mock.calls[0];
    expect(query.include.jasaItems.where).toEqual(NOT_REJECTED);
    expect(query.include.items.where).toEqual(NOT_REJECTED);
  });

  it("tidak bisa menandai selesai jasa yang ditolak penyetuju", async () => {
    // Jasa yang ditolak tersaring dari query, jadi tidak dikenali sebagai bagian pengajuan.
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      status: "ORDERED",
      jasaItems: [{ id: "jasa-1", jasa: { nama: "Tarik Kabel" } }],
      items: [],
    });

    const response = await confirmRestockJasaItems({
      purchaseRequestId: "pr-1",
      items: [{ jasaItemId: "jasa-ditolak", buktiSelesai: ["foto.jpg"] }],
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("sudah ditolak penyetuju");
    expect(jasaItemMock.update).not.toHaveBeenCalled();
  });

  it("menandai pengajuan diterima bila sisa jasa yang tidak ditolak sudah selesai", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      status: "ORDERED",
      jasaItems: [{ id: "jasa-1", jasa: { nama: "Tarik Kabel" } }],
      items: [],
    });
    jasaItemMock.count.mockResolvedValue(0);

    const response = await confirmRestockJasaItems({
      purchaseRequestId: "pr-1",
      items: [{ jasaItemId: "jasa-1", buktiSelesai: ["foto.jpg"] }],
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    expect(response.status).toBe(200);
    expect(jasaItemMock.count).toHaveBeenCalledWith({
      where: {
        purchaseRequestId: "pr-1",
        statusKonfirmasi: "PENDING",
        ...NOT_REJECTED,
      },
    });
    expect(prismaMock.purchaseRequest.update).toHaveBeenCalledWith({
      where: { id: "pr-1" },
      data: { status: "RECEIVED" },
    });
  });
});
