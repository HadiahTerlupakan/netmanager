import { describe, expect, it, vi } from "vitest";
import { CustomerLegacyBillingService } from "@/modules/pelanggan";

const pelangganRepository = {
  findCustomerBillingAccess: vi.fn(),
};
const invoiceRepository = {
  findLegacyTagihanByPelanggan: vi.fn(),
};

describe("CustomerLegacyBillingService", () => {
  it("mengembalikan tagihan latest dengan mapping status legacy", async () => {
    pelangganRepository.findCustomerBillingAccess.mockResolvedValue({
      id: "pel-1",
      siteId: "site-1",
    });
    invoiceRepository.findLegacyTagihanByPelanggan.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV-1",
        subtotal: 1000,
        discountAmount: 100,
        taxAmount: 110,
        totalAmount: 1010,
        status: "OVERDUE",
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
        paidAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        payment: [],
      },
    ]);
    const service = new CustomerLegacyBillingService(
      pelangganRepository as never,
      invoiceRepository as never,
    );

    const result = await service.getCustomerTagihan({
      pelangganId: "pel-1",
      tenantId: "tenant-1",
      isLatest: true,
    });

    expect(result).toEqual({
      tagihan: expect.objectContaining({
        id: "inv-1",
        status: "TERLAMBAT",
        periodeBulan: 4,
        periodeTahun: 2026,
      }),
    });
  });
});
