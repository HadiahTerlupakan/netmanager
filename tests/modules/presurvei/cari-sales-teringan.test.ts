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
import { daftarStatusBebanAktif } from "@/modules/presurvei/domain/prospek-rules";

// Bentuk minimal argumen yang benar-benar dikirim cariSalesTeringan ke
// findMany. Tipe hasil generate Prisma untuk `_count` adalah union
// `boolean | { select?: ... }` — mustahil diakses lewat optional chaining
// biasa tanpa penyempitan ini.
interface ArgumenPencarianSales {
  where?: { tenantId?: string; isSales?: boolean; isActive?: boolean };
  select?: {
    _count?: {
      select?: {
        presurveiProspek?: {
          where?: { tenantId?: string; status?: { in: string[] } };
        };
      };
    };
  };
}

describe("cariSalesTeringan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menyaring sales lewat tenantId pada where level atas", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await cariSalesTeringan("tenant-1");

    const argumen = vi.mocked(prisma.user.findMany).mock
      .calls[0][0] as ArgumenPencarianSales;
    expect(argumen?.where).toEqual({
      tenantId: "tenant-1",
      isSales: true,
      isActive: true,
    });
  });

  it("menyaring hitungan beban dengan tenantId yang sama pada where bersarang dalam _count", async () => {
    // Bagian ini yang tidak dijangkau ekstensi Prisma — assert bentuk
    // bersarangnya secara eksplisit, bukan cuma memastikan findMany terpanggil.
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await cariSalesTeringan("tenant-1");

    const argumen = vi.mocked(prisma.user.findMany).mock
      .calls[0][0] as ArgumenPencarianSales;
    expect(argumen?.select?._count?.select?.presurveiProspek?.where).toEqual({
      tenantId: "tenant-1",
      status: { in: daftarStatusBebanAktif() },
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
