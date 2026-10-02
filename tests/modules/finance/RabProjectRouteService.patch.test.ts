import { describe, expect, it, vi } from "vitest";

import { RabProjectRouteService } from "@/modules/finance";

const updatedProject = {
  id: "rab-1",
  projectedRevenue: 1000n,
  projectedOpex: 200n,
  arpu: 50n,
  contingencyAmount: 25n,
  opexBufferInvestorFixedAmount: 10n,
  items: [
    {
      id: "item-1",
      unitPrice: 100n,
      totalPrice: 300n,
      disbursements: [{ id: "disbursement-1", amount: 75n }],
    },
  ],
  wbsGroups: [] as unknown[],
};

describe("RabProjectRouteService PATCH", () => {
  it("menolak status approval yang harus diproses melalui approval endpoint", async () => {
    const repository = {
      updateProjectWithRelations: vi.fn(),
    };
    const service = new RabProjectRouteService(repository as never);

    await expect(
      service.updateProject("rab-1", { status: "APPROVED" }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Status approval RAB wajib diproses melalui endpoint approval.",
    });
    expect(repository.updateProjectWithRelations).not.toHaveBeenCalled();
  });

  it("mengupdate proyek dan menserialisasi nilai bigint untuk response route", async () => {
    const repository = {
      updateProjectWithRelations: vi.fn().mockResolvedValue(updatedProject),
      hasBagiHasilInvestor: vi.fn().mockResolvedValue(false),
    };
    const service = new RabProjectRouteService(repository as never);

    const result = await service.updateProject("rab-1", { name: "RAB Baru" });

    expect(repository.updateProjectWithRelations).toHaveBeenCalledWith(
      "rab-1",
      {
        name: "RAB Baru",
      },
      false,
    );
    expect(result).toEqual({
      ...updatedProject,
      projectedRevenue: "1000",
      projectedOpex: "200",
      arpu: "50",
      contingencyAmount: "25",
      opexBufferInvestorFixedAmount: "10",
      items: [
        {
          ...updatedProject.items[0],
          unitPrice: "100",
          totalPrice: "300",
          disbursements: [
            {
              ...updatedProject.items[0].disbursements[0],
              amount: "75",
            },
          ],
        },
      ],
    });
  });

  it("mengembalikan not found ketika proyek yang diupdate tidak ada", async () => {
    const repository = {
      updateProjectWithRelations: vi.fn().mockResolvedValue(null),
      hasBagiHasilInvestor: vi.fn().mockResolvedValue(false),
    };
    const service = new RabProjectRouteService(repository as never);

    await expect(
      service.updateProject("rab-1", { name: "RAB Baru" }),
    ).rejects.toMatchObject({ status: 404, message: "Proyek RAB" });
  });

  it("RAB yang sudah punya bagi hasil: tanggal mulai tidak bisa diubah (409)", async () => {
    const repository = {
      updateProjectWithRelations: vi.fn(),
      hasBagiHasilInvestor: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue({ startDate: new Date("2026-06-01T00:00:00.000Z") }),
    };
    const service = new RabProjectRouteService(repository as never);

    await expect(
      service.updateProject("rab-1", { startDate: new Date("2026-08-01T00:00:00.000Z") }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.updateProjectWithRelations).not.toHaveBeenCalled();

    repository.updateProjectWithRelations.mockResolvedValue(null);
    await service
      .updateProject("rab-1", { startDate: new Date("2026-06-01T00:00:00.000Z") })
      .catch((): undefined => undefined);
    expect(repository.updateProjectWithRelations).toHaveBeenCalledWith(
      "rab-1",
      expect.anything(),
      true,
    );
  });

  it("perubahan investor/modal yang dikunci repository menjadi 409", async () => {
    const { ModalInvestorTerkunciError } = await import(
      "@/modules/finance/repositories/RabProjectUpdateRepository"
    );
    const repository = {
      updateProjectWithRelations: vi.fn().mockRejectedValue(new ModalInvestorTerkunciError()),
      hasBagiHasilInvestor: vi.fn().mockResolvedValue(true),
    };
    const service = new RabProjectRouteService(repository as never);

    await expect(service.updateProject("rab-1", { investorIds: ["inv-x"] })).rejects.toMatchObject({
      status: 409,
    });
  });
});
