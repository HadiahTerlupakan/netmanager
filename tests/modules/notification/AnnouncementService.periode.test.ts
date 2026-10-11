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
import {
  buildAnnouncementWhere,
  buildMobileAnnouncementWhere,
} from "@/modules/notification/services/AnnouncementService.helpers";
import type { IAnnouncementRepository } from "@/modules/notification/domain/ports/IAnnouncementRepository";

const SEKARANG = new Date("2026-10-11T12:00:00.000Z");

/** Cabang `startDate: null` inilah yang dulu hilang. */
const SYARAT_PERIODE = [
  { OR: [{ startDate: null }, { startDate: { lte: SEKARANG } }] },
  { OR: [{ endDate: null }, { endDate: { gte: SEKARANG } }] },
];

describe("penyaring periode pengumuman", () => {
  it("memperlakukan tanggal mulai kosong sebagai berlaku sejak awal di jalur mobile", () => {
    const where = buildMobileAnnouncementWhere(null, "employee", SEKARANG);

    expect(where.AND).toEqual(SYARAT_PERIODE);
    expect(where).not.toHaveProperty("startDate");
  });

  it.each(["customer", "employee", "admin"] as const)(
    "memperlakukan tanggal mulai kosong sebagai berlaku sejak awal di portal %s",
    (portal) => {
      const where = buildAnnouncementWhere(
        { activeOnly: true, portal },
        SEKARANG,
      );

      expect(where).toMatchObject({ isActive: true, AND: SYARAT_PERIODE });
    },
  );

  it("tetap menyaring tenant pada jalur mobile", () => {
    const where = buildMobileAnnouncementWhere(
      "tenant-1",
      "employee",
      SEKARANG,
    );

    expect(where).toMatchObject({ tenantId: "tenant-1" });
  });
});

function buildRepository(
  overrides: Partial<IAnnouncementRepository> = {},
): IAnnouncementRepository {
  return {
    findExistingById: vi.fn().mockResolvedValue({ id: "ann-1" }),
    findEditById: vi.fn().mockResolvedValue({
      id: "ann-1",
      title: "Judul",
      content: "Konten",
      target: "ALL",
      isActive: true,
      isPinned: false,
      startDate: new Date("2026-10-10T00:00:00.000Z"),
      endDate: new Date("2026-10-20T00:00:00.000Z"),
    }),
    update: vi.fn().mockResolvedValue({ id: "ann-1" }),
    ...overrides,
  } as unknown as IAnnouncementRepository;
}

describe("AnnouncementService.updateAnnouncement — validasi periode sebagian", () => {
  it("menolak tanggal berakhir yang mendahului tanggal mulai tersimpan", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await expect(
      service.updateAnnouncement("ann-1", {
        endDate: "2026-10-01T00:00:00.000Z",
      }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof AnnouncementServiceError &&
        e.status === 400 &&
        e.message === "Tanggal berakhir harus setelah tanggal mulai",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("menolak tanggal mulai yang melewati tanggal berakhir tersimpan", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await expect(
      service.updateAnnouncement("ann-1", {
        startDate: "2026-10-25T00:00:00.000Z",
      }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof AnnouncementServiceError && e.status === 400,
    );
  });

  it("menerima tanggal berakhir yang masih setelah tanggal mulai tersimpan", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await service.updateAnnouncement("ann-1", {
      endDate: "2026-10-30T00:00:00.000Z",
    });

    expect(repository.update).toHaveBeenCalled();
  });

  it("menerima pengosongan tanggal berakhir", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await service.updateAnnouncement("ann-1", { endDate: null });

    expect(repository.update).toHaveBeenCalled();
  });

  it("tidak membaca baris tersimpan saat periode tidak diubah", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await service.updateAnnouncement("ann-1", { title: "Judul baru" });

    expect(repository.findEditById).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
  });

  it("tidak membaca baris tersimpan saat kedua tanggal dikirim (sudah dijaga Zod)", async () => {
    const repository = buildRepository();
    const service = new AnnouncementService(repository);

    await service.updateAnnouncement("ann-1", {
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-11-02T00:00:00.000Z",
    });

    expect(repository.findEditById).not.toHaveBeenCalled();
  });
});
