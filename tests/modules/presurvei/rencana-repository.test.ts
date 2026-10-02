import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Penulisan rencana wajib menyaring `tenantId` eksplisit (fail-closed): untuk
 * super admin ekstensi tenant tidak menyaring apa pun, jadi id rencana tenant
 * lain tidak boleh tersentuh hanya karena id-nya cocok.
 */

const { updateMany, findUnique } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: { presurveiRencana: { updateMany, findUnique } },
}));

import { RencanaRepository } from "@/modules/presurvei/repositories/RencanaRepository";

const TENANT = "tenant-1";

describe("RencanaRepository — penulisan dibatasi tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
  });

  it("ubahSelagiTerbuka menyaring id, tenantId, dan status terbuka", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await new RencanaRepository().ubahSelagiTerbuka("r-1", TENANT, { tujuan: "Survei ulang" });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-1", tenantId: TENANT, status: "DIRENCANAKAN" },
      }),
    );
  });

  it("batalkanSelagiTerbuka menyaring id, tenantId, dan status terbuka", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const hasil = await new RencanaRepository().batalkanSelagiTerbuka("r-1", TENANT, {
      alasan: "hujan",
      olehId: "u-1",
      pada: new Date("2026-10-02T00:00:00Z"),
    });

    expect(hasil).toBeNull();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-1", tenantId: TENANT, status: "DIRENCANAKAN" },
      }),
    );
  });

  it("menolak penulisan tanpa tenantId", async () => {
    await expect(
      new RencanaRepository().ubahSelagiTerbuka("r-1", "", { tujuan: "x" }),
    ).rejects.toThrow(/tanpa tenantId/);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
