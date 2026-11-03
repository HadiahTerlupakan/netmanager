import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/modules/database", () => ({
  prisma: { legalDocument: { findMany } },
}));

import { LegalPartyContractRepository } from "@/modules/legal/repositories/LegalPartyContractRepository";

describe("LegalPartyContractRepository", () => {
  beforeEach(() => findMany.mockReset().mockResolvedValue([]));

  it("kontrak pihak terkait yang belum diakhiri — termasuk yang sudah diperpanjang — dalam tenant", async () => {
    await new LegalPartyContractRepository().findMonitoredContracts({
      tenantId: "tenant-1",
      partyType: "RESELLER",
      partyIds: ["r1", "r2"],
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        documentType: "KONTRAK",
        partyType: "RESELLER",
        partyId: { in: ["r1", "r2"] },
        terminatedAt: null,
        tenantId: "tenant-1",
      },
      select: {
        id: true,
        partyId: true,
        startDate: true,
        endDate: true,
        renewedBy: {
          select: { startDate: true, endDate: true, terminatedAt: true },
        },
      },
    });
  });

  it("tidak query untuk daftar pihak kosong", async () => {
    const rows =
      await new LegalPartyContractRepository().findMonitoredContracts({
        tenantId: "tenant-1",
        partyType: "RESELLER",
        partyIds: [],
      });

    expect(rows).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
