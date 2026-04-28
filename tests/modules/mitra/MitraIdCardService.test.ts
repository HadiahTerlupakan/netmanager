import { describe, expect, it, vi } from "vitest";

import { MitraIdCardService } from "@/modules/mitra";
import type { IMitraRepository } from "@/modules/mitra/domain/ports/IMitraRepository";

function createRepository(): IMitraRepository {
  return {
    clearPushTokens: vi.fn(),
    findManyWithPushToken: vi.fn(),
    findPushTokenById: vi.fn(),
    findManyWithPushTokenByIds: vi.fn(),
    findByIdSimple: vi.fn(),
    findIdsBySite: vi.fn(),
    findCanvasingSummary: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    getStats: vi.fn(),
    createMitra: vi.fn(),
    updateMitra: vi.fn(),
    softDeleteMitra: vi.fn(),
    getFaceVerificationLogs: vi.fn(),
    countPendingWithdrawals: vi.fn(),
    getFeePelangganStats: vi.fn(),
    saveFaceVerification: vi.fn(),
    findIdCardById: vi.fn().mockResolvedValue({
      id: "mitra-1",
      name: "Teknisi Satu",
      mitraType: "MITRA_TEKNISI",
      nik: "3201",
      fotoDiri: null,
      phone: "08123",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      site: { name: "Site Barat" },
    }),
    findIdCardTitleById: vi.fn(),
  };
}

describe("MitraIdCardService", () => {
  it("mengambil data ID card aktif dan menyiapkan DTO client", async () => {
    const repository = createRepository();
    const service = new MitraIdCardService(repository);

    const result = await service.getIdCardData("mitra-1");

    expect(repository.findIdCardById).toHaveBeenCalledWith("mitra-1");
    expect(result).toEqual({
      id: "mitra-1",
      name: "Teknisi Satu",
      mitraType: "MITRA_TEKNISI",
      nik: "3201",
      fotoDiri: null,
      phone: "08123",
      createdAt: "2026-04-01T00:00:00.000Z",
      sites: { name: "Site Barat" },
    });
  });

  it("mengambil judul metadata dengan fallback Mitra", async () => {
    const repository = createRepository();
    vi.mocked(repository.findIdCardTitleById).mockResolvedValue({ name: null });
    const service = new MitraIdCardService(repository);

    const result = await service.getIdCardTitle("mitra-1");

    expect(repository.findIdCardTitleById).toHaveBeenCalledWith("mitra-1");
    expect(result).toBe("ID Card - Mitra");
  });
});
