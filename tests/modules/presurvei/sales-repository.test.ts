import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Daftar sales presurvei — satu-satunya pembacaan tabel `User` yang
 * ditambahkan Fase 3.
 *
 * `prisma.user.findMany` diganti tiruan yang BENAR-BENAR menyaring berdasarkan
 * `where` yang diterimanya, di atas penghuni dua tenant. Dengan begitu test
 * membuktikan perilakunya — sales tenant lain tidak muncul — bukan sekadar
 * bentuk argumennya. Membuang `tenantId` dari `where` membuat sales tenant B
 * ikut kembali dan test pertama merah.
 */

interface PenggunaTiruan {
  id: string;
  name: string | null;
  email: string;
  tenantId: string | null;
  isSales: boolean;
  isActive: boolean;
}

const { penghuni } = vi.hoisted(() => ({
  penghuni: [] as PenggunaTiruan[],
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          select: Record<string, boolean>;
        }) =>
          penghuni
            .filter((pengguna) =>
              Object.entries(args.where).every(
                ([kolom, nilai]) =>
                  pengguna[kolom as keyof PenggunaTiruan] === nilai,
              ),
            )
            .map((pengguna) =>
              Object.fromEntries(
                Object.keys(args.select).map((kolom) => [
                  kolom,
                  pengguna[kolom as keyof PenggunaTiruan],
                ]),
              ),
            ),
      ),
    },
  },
}));

import { prisma } from "@/modules/database";
import { SalesRepository } from "@/modules/presurvei/repositories/SalesRepository";

const pengguna = (
  ubahan: Partial<PenggunaTiruan> & { id: string },
): PenggunaTiruan => ({
  name: null,
  email: `${ubahan.id}@contoh.id`,
  tenantId: "tenant-a",
  isSales: true,
  isActive: true,
  ...ubahan,
});

describe("SalesRepository.daftarAktif", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findMany).mockClear();
    penghuni.length = 0;
    penghuni.push(
      pengguna({ id: "sales-a-rina", name: "Rina" }),
      pengguna({ id: "sales-a-budi", name: "Budi" }),
      pengguna({ id: "sales-b-citra", name: "Citra", tenantId: "tenant-b" }),
      pengguna({ id: "sales-b-anto", name: "Anto", tenantId: "tenant-b" }),
      pengguna({ id: "admin-a", name: "Admin", isSales: false }),
      pengguna({ id: "sales-a-cuti", name: "Cuti", isActive: false }),
    );
  });

  it("tidak mengembalikan sales dari tenant lain", async () => {
    const hasil = await new SalesRepository().daftarAktif("tenant-a");

    const ids = hasil.map((sales) => sales.id);
    expect(ids).not.toContain("sales-b-citra");
    expect(ids).not.toContain("sales-b-anto");
    expect(ids).toEqual(["sales-a-budi", "sales-a-rina"]);
  });

  it("memakai definisi sales yang sama dengan penugasan prospek otomatis", async () => {
    // Dibandingkan utuh dengan `cari-sales-teringan.ts:22`: isSales dan
    // isActive dalam satu tenant, tanpa syarat tambahan.
    await new SalesRepository().daftarAktif("tenant-a");

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", isSales: true, isActive: true },
      // Tanpa `email`: kolom yang tidak diambil tidak bisa bocor.
      select: { id: true, name: true },
    });
  });

  it("melewatkan non-sales dan sales nonaktif", async () => {
    const ids = (await new SalesRepository().daftarAktif("tenant-a")).map(
      (sales) => sales.id,
    );

    expect(ids).not.toContain("admin-a");
    expect(ids).not.toContain("sales-a-cuti");
  });

  it("memberi label netral pada sales tanpa nama, lalu mengurutkan menurut label", async () => {
    penghuni.push(
      pengguna({ id: "sales-a-x9k2mz", name: null, email: "anonim@contoh.id" }),
    );

    expect(await new SalesRepository().daftarAktif("tenant-a")).toEqual([
      { id: "sales-a-budi", nama: "Budi" },
      { id: "sales-a-rina", nama: "Rina" },
      { id: "sales-a-x9k2mz", nama: "Tanpa nama (…x9k2mz)" },
    ]);
  });

  it("tidak membawa email siapa pun di hasilnya", async () => {
    penghuni.push(
      pengguna({ id: "sales-a-anonim", name: null, email: "anonim@contoh.id" }),
    );

    const hasil = await new SalesRepository().daftarAktif("tenant-a");

    expect(JSON.stringify(hasil)).not.toContain("@contoh.id");
  });

  it("menolak tanpa menyentuh database saat tenantId kosong", async () => {
    // Prisma membaca `tenantId: undefined` sebagai "tanpa syarat" — seluruh
    // sales semua tenant. `strictNullChecks: false` tidak mencegahnya sampai
    // ke sini dari `session.user.tenantId` yang kosong.
    await expect(
      new SalesRepository().daftarAktif(undefined as unknown as string),
    ).rejects.toThrow("tanpa tenantId");
    await expect(new SalesRepository().daftarAktif("")).rejects.toThrow(
      "tanpa tenantId",
    );

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
