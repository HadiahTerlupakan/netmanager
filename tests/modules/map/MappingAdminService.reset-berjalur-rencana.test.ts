import { describe, expect, it, vi } from "vitest";

import { MappingAdminService } from "@/modules/map/services/MappingAdminService";
import type { IMappingRepository } from "@/modules/map/domain/ports/IMappingRepository";
import type { MappingService } from "@/modules/map/services/MappingService";

/**
 * Peta rencana sengaja boleh menarik kabel ke node yang sudah berdiri — itu
 * gunanya menggambar di atas konteks jaringan nyata. Konsekuensinya: node nyata
 * itu tidak bisa dihapus selama jalur rencananya masih ada, sebab FK
 * `source`/`target` ber-`ON DELETE RESTRICT`.
 *
 * Tanpa penjaga ini `POST /api/map/reset` tetap gagal, tapi gagal sebagai galat
 * Prisma yang diterjemahkan menjadi 500 "Terjadi kesalahan pada server".
 * Operator tidak bisa membedakan reset yang terhalang rencana dari server yang
 * rusak.
 */

const CTX = { tenantId: "tenant-1", isSuperAdmin: false };

function buatService(jumlahJalurRencana: number) {
  const countPlannedEdgesOnRealNodes = vi
    .fn()
    .mockResolvedValue(jumlahJalurRencana);
  const resetAllMappingData = vi.fn().mockResolvedValue(undefined);
  const repo = {
    countPlannedEdgesOnRealNodes,
    resetAllMappingData,
  } as unknown as IMappingRepository;

  const service = new MappingAdminService(repo, {} as MappingService, {
    verifyUserPassword: vi.fn(),
  });

  return { service, countPlannedEdgesOnRealNodes, resetAllMappingData };
}

describe("MappingAdminService.resetAllMappingData", () => {
  it("menolak selama ada jalur rencana menempel di node nyata", async () => {
    const { service, resetAllMappingData } = buatService(4);

    await expect(service.resetAllMappingData(CTX)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: { jumlahJalurRencana: 4 },
    });
    expect(resetAllMappingData).not.toHaveBeenCalled();
  });

  it("menyebut jumlahnya, bukan pesan 500 generik", async () => {
    const { service } = buatService(4);

    await expect(service.resetAllMappingData(CTX)).rejects.toThrow(
      /4 jalur kabel rencana/,
    );
  });

  it("meneruskan reset ketika tidak ada jalur rencana menempel", async () => {
    const { service, resetAllMappingData } = buatService(0);

    await service.resetAllMappingData(CTX);

    expect(resetAllMappingData).toHaveBeenCalledWith(CTX);
  });
});
