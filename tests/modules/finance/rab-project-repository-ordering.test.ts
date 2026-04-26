import { describe, expect, it, vi } from "vitest";
import { RabProjectRepository } from "@/modules/finance/repositories/RabProjectRepository";

describe("RabProjectRepository ordering", () => {
  it("mengambil list RAB dengan urutan stabil dari data terbaru", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new RabProjectRepository({
      rabProject: { findMany },
    } as never);

    await repository.findManyWithDetails({ status: "DRAFT" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: expect.objectContaining({
          items: expect.objectContaining({
            orderBy: [{ wbsId: "asc" }, { id: "asc" }],
            include: expect.objectContaining({
              disbursements: {
                orderBy: [{ estimatedDate: "asc" }, { id: "asc" }],
              },
            }),
          }),
          wbsGroups: { orderBy: [{ order: "asc" }, { id: "asc" }] },
          investors: { orderBy: { id: "asc" } },
          approvals: expect.objectContaining({
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          }),
        }),
      }),
    );
  });
});
