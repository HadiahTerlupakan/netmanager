import { describe, expect, it, vi } from "vitest";

import { ReceivablesPageService } from "@/modules/finance";
import type { IReceivablesRepository } from "@/modules/finance/domain/ports/IReceivablesRepository";

function createRepository(): IReceivablesRepository {
  return {
    findReceivables: vi.fn().mockResolvedValue([
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        pelangganId: "pelanggan-1",
        pelanggan: {
          id: "pelanggan-1",
          idPelanggan: "CUST-001",
          nama: "Budi",
        },
        status: "SENT",
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
        issueDate: new Date("2026-04-01T00:00:00.000Z"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
        totalAmount: 150000n,
        paidAmount: 50000n,
        subtotal: 140000n,
        taxAmount: 10000n,
        discountAmount: 0n,
        payment: [
          {
            id: "payment-1",
            amount: 50000n,
          },
        ],
      },
    ]),
  };
}

describe("ReceivablesPageService", () => {
  it("mengambil receivables dari repository dan menormalisasi nilai numeric", async () => {
    const repository = createRepository();
    const service = new ReceivablesPageService(repository);

    const result = await service.getReceivables();

    expect(repository.findReceivables).toHaveBeenCalledOnce();
    expect(result).toEqual([
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        pelangganId: "pelanggan-1",
        pelanggan: {
          id: "pelanggan-1",
          idPelanggan: "CUST-001",
          nama: "Budi",
        },
        status: "SENT",
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
        issueDate: new Date("2026-04-01T00:00:00.000Z"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
        totalAmount: 150000,
        paidAmount: 50000,
        subtotal: 140000,
        taxAmount: 10000,
        discountAmount: 0,
        payment: [
          {
            id: "payment-1",
            amount: 50000,
          },
        ],
      },
    ]);
  });
});
