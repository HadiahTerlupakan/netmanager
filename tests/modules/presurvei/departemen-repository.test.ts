import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Penjaga fail-closed `DepartemenRepository.daftar`.
 *
 * Dengan `strictNullChecks: false` compiler meloloskan `undefined` ke
 * `tenantId`, dan Prisma memperlakukan `tenantId: undefined` sebagai "tanpa
 * syarat" — departemen SEMUA tenant. Route sudah menolak sesi tanpa tenant;
 * ini lapis keduanya.
 */

vi.mock("@/modules/database", () => ({
  prisma: { departments: { findMany: vi.fn(async () => []) } },
}));

import { prisma } from "@/modules/database";
import { DepartemenRepository } from "@/modules/presurvei/repositories/DepartemenRepository";

describe("DepartemenRepository.daftar", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([undefined, null, ""])(
    "menolak tenantId %s tanpa menyentuh database",
    async (tenantId) => {
      await expect(
        new DepartemenRepository().daftar(tenantId as unknown as string),
      ).rejects.toThrow();
      expect(prisma.departments.findMany).not.toHaveBeenCalled();
    },
  );

  it("menulis tenantId eksplisit dan hanya memilih id dan nama", async () => {
    await new DepartemenRepository().daftar("tenant-a");

    expect(prisma.departments.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a" },
      select: { id: true, name: true },
    });
  });
});
