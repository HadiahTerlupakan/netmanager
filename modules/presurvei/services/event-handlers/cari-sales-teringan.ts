import { prisma } from "@/modules/database";
import { daftarStatusBebanAktif } from "../../domain/prospek-rules";

/**
 * Sales dengan beban prospek paling ringan di sebuah tenant, atau null bila
 * tenant itu tidak punya sales aktif.
 *
 * Prospek dari form publik tidak membawa petunjuk siapa yang harus menanganinya,
 * jadi dibagi merata. Mengembalikan null — bukan menempelkannya ke orang pertama
 * yang ditemukan — supaya prospek tak bertuan terlihat jelas di daftar admin.
 *
 * `tenantId` wajib dan dipakai dua kali: pada sales yang dicari, dan pada
 * hitungan bebannya. Yang kedua tidak bisa diserahkan ke ekstensi Prisma —
 * ekstensi hanya menulis ulang `where` level atas, tidak yang bersarang di
 * dalam `_count`.
 */
export async function cariSalesTeringan(
  tenantId: string,
): Promise<string | null> {
  const statusBeban = daftarStatusBebanAktif();

  const sales = await prisma.user.findMany({
    where: { tenantId, isSales: true, isActive: true },
    select: {
      id: true,
      _count: {
        select: {
          presurveiProspek: {
            where: { tenantId, status: { in: statusBeban } },
          },
        },
      },
    },
  });

  if (sales.length === 0) return null;

  return sales.reduce((teringan, kandidat) =>
    kandidat._count.presurveiProspek < teringan._count.presurveiProspek
      ? kandidat
      : teringan,
  ).id;
}
