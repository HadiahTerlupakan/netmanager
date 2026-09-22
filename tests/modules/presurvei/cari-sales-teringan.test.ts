import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `cariSalesTeringan` memikul satu-satunya bagian filter tenant yang tidak
 * dijangkau ekstensi Prisma: `where` bersarang di dalam `_count`. Ekstensi
 * hanya menulis ulang `args` level atas, jadi tanpa `where` bersarang ini
 * hitungan beban seorang sales bisa mencakup prospek tenant lain walau
 * konteksnya sendiri sudah benar.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { cariSalesTeringan } from "@/modules/presurvei/services/event-handlers/cari-sales-teringan";

describe("cariSalesTeringan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menyaring sales dan hitungan bebannya lewat tenantId, termasuk where bersarang dalam _count", async () => {
    // `where` bersarang di dalam `_count` adalah bagian yang tidak dijangkau
    // ekstensi Prisma — dibandingkan utuh dalam satu `toEqual`, bukan dibaca
    // sebagian lewat cast, supaya key tambahan atau nilai yang meleset di
    // mana pun dalam argumen ini ikut tertangkap.
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await cariSalesTeringan("tenant-1");

    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toEqual({
      where: { tenantId: "tenant-1", isSales: true, isActive: true },
      select: {
        id: true,
        _count: {
          select: {
            presurveiProspek: {
              where: {
                tenantId: "tenant-1",
                status: { in: ["BARU", "DIHUBUNGI", "TERTARIK", "NEGOSIASI"] },
              },
            },
          },
        },
      },
    });
  });

  it("memilih sales dengan hitungan beban terkecil, dan null saat tenant tidak punya sales", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "sales-berat", _count: { presurveiProspek: 5 } },
      { id: "sales-ringan", _count: { presurveiProspek: 2 } },
      { id: "sales-sedang", _count: { presurveiProspek: 3 } },
    ] as never);

    expect(await cariSalesTeringan("tenant-1")).toBe("sales-ringan");

    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    expect(await cariSalesTeringan("tenant-1")).toBeNull();
  });
});
