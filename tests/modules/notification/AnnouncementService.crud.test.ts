import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({
  prisma: {
    announcement: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    announcementRead: { upsert: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() },
    pelanggan: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
  },
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: { publish: vi.fn() },
}));

vi.mock("@/lib/expo", () => ({
  sendExpoPushNotifications: vi.fn(),
}));

import {
  AnnouncementService,
  AnnouncementServiceError,
} from "@/modules/notification";
import type { IAnnouncementRepository } from "@/modules/notification/domain/ports/IAnnouncementRepository";

function buildRepository(
  overrides: Partial<IAnnouncementRepository> = {},
): IAnnouncementRepository {
  return {
    findExistingById: vi.fn().mockResolvedValue({ id: "ann-1" }),
    update: vi.fn().mockResolvedValue({ id: "ann-1", title: "Updated" }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IAnnouncementRepository;
}

describe("AnnouncementService.updateAnnouncement", () => {
  it("melempar 404 ketika announcement tidak ditemukan", async () => {
    const repository = buildRepository({
      findExistingById: vi.fn().mockResolvedValue(null),
    });
    const service = new AnnouncementService(repository);

    await expect(
      service.updateAnnouncement("non-existent", { title: "X" }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof AnnouncementServiceError && e.status === 404,
    );
  });

  it("mengembalikan data terbaru ketika announcement ditemukan", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    const result = await service.updateAnnouncement("ann-1", {
      title: "Updated",
    });

    expect(repository.update).toHaveBeenCalledWith(
      "ann-1",
      expect.objectContaining({ title: "Updated" }),
    );
    expect(result).toMatchObject({ id: "ann-1" });
  });
});

describe("AnnouncementService.deleteAnnouncement", () => {
  it("melempar 404 ketika announcement tidak ditemukan", async () => {
    const repository = buildRepository({
      findExistingById: vi.fn().mockResolvedValue(null),
    });
    const service = new AnnouncementService(repository);

    await expect(service.deleteAnnouncement("non-existent")).rejects.toSatisfy(
      (e: unknown) => e instanceof AnnouncementServiceError && e.status === 404,
    );
  });

  it("mengembalikan success true ketika announcement berhasil dihapus", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    const result = await service.deleteAnnouncement("ann-1");

    expect(repository.delete).toHaveBeenCalledWith("ann-1");
    expect(result).toEqual({ success: true });
  });
});
