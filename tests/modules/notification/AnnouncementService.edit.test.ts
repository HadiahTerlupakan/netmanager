import { describe, expect, it, vi } from "vitest";

import { AnnouncementService } from "@/modules/notification";
import type { IAnnouncementRepository } from "@/modules/notification/domain/ports/IAnnouncementRepository";

function createRepository(): IAnnouncementRepository {
  return {
    findEditById: vi.fn().mockResolvedValue({
      id: "ann-1",
      title: "Info Maintenance",
      content: "Internet akan maintenance",
      target: "ADMIN",
      isActive: true,
      isPinned: false,
      startDate: new Date("2026-04-27T08:00:00.000Z"),
      endDate: null,
    }),
  };
}

describe("AnnouncementService edit data", () => {
  it("mengambil data edit announcement dari repository dan menserialisasi tanggal", async () => {
    const repository = createRepository();
    const service = new AnnouncementService(repository);

    const result = await service.getAnnouncementEditData("ann-1");

    expect(repository.findEditById).toHaveBeenCalledWith("ann-1");
    expect(result).toEqual({
      id: "ann-1",
      title: "Info Maintenance",
      content: "Internet akan maintenance",
      target: "ADMIN",
      isActive: true,
      isPinned: false,
      startDate: "2026-04-27T08:00:00.000Z",
      endDate: null,
    });
  });
});
