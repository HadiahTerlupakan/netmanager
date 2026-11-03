import { describe, expect, it, vi } from "vitest";

import type { IResellerStatusHistoryRepository } from "@/modules/reseller/domain/ports/IResellerStatusHistoryRepository";
import { ResellerService } from "@/modules/reseller/services/ResellerService";
import { ResellerStatusHistoryService } from "@/modules/reseller/services/ResellerStatusHistoryService";
import { createResellerRepositoryMock } from "./reseller-fixtures";

function createHistoryRepository(): IResellerStatusHistoryRepository {
  return {
    findByResellerId: vi.fn().mockResolvedValue({
      items: [
        {
          id: "h1",
          tenantId: "tenant-1",
          resellerId: "reseller-1",
          fromStatus: null,
          toStatus: "SUSPENDED",
          reason: "Menunggu PKS",
          changedById: "admin-1",
          changedAt: new Date("2026-11-03T02:00:00.000Z"),
        },
      ],
      total: 21,
    }),
  };
}

describe("ResellerStatusHistoryService.listStatusHistory", () => {
  it("memetakan halaman riwayat ke DTO dengan offset dari page/limit", async () => {
    const resellers = createResellerRepositoryMock();
    vi.mocked(resellers.findById).mockResolvedValueOnce({
      id: "reseller-1",
    } as never);
    const history = createHistoryRepository();

    const result = await new ResellerStatusHistoryService(
      resellers,
      history,
    ).listStatusHistory({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      page: 3,
      limit: 10,
    });

    expect(resellers.findById).toHaveBeenCalledWith("tenant-1", "reseller-1");
    expect(history.findByResellerId).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      skip: 20,
      take: 10,
    });
    expect(result).toEqual({
      items: [
        {
          id: "h1",
          fromStatus: null,
          toStatus: "SUSPENDED",
          reason: "Menunggu PKS",
          changedById: "admin-1",
          changedAt: "2026-11-03T02:00:00.000Z",
        },
      ],
      total: 21,
    });
  });

  it("reseller tidak ada di tenant: null tanpa membaca riwayat", async () => {
    const resellers = createResellerRepositoryMock();
    vi.mocked(resellers.findById).mockResolvedValueOnce(null);
    const history = createHistoryRepository();

    const result = await new ResellerStatusHistoryService(
      resellers,
      history,
    ).listStatusHistory({
      tenantId: "tenant-2",
      resellerId: "reseller-1",
      page: 1,
      limit: 20,
    });

    expect(result).toBeNull();
    expect(history.findByResellerId).not.toHaveBeenCalled();
  });
});

describe("ResellerService.deleteReseller", () => {
  it("meneruskan pelaku ke repository agar riwayat status mencatatnya", async () => {
    const repository = createResellerRepositoryMock();

    await new ResellerService(repository).deleteReseller(
      "tenant-1",
      "reseller-1",
      "admin-1",
    );

    expect(repository.softDelete).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      "admin-1",
    );
  });
});
