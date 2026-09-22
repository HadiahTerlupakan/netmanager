import { prisma } from "@/modules/database";
import { PROSPEK_STATUSES } from "../../domain/entities/Prospek";
import { isStatusFinal } from "../../domain/prospek-rules";

/**
 * Sales dengan prospek aktif paling sedikit, atau null bila tidak ada sales.
 *
 * Prospek dari form publik tidak membawa petunjuk siapa yang harus menanganinya,
 * jadi dibagi merata. Mengembalikan null — bukan menempelkannya ke orang pertama
 * yang ditemukan — supaya prospek tak bertuan terlihat jelas di daftar admin.
 */
export async function cariSalesTeringan(): Promise<string | null> {
  const statusAktif = PROSPEK_STATUSES.filter(
    (status) => !isStatusFinal(status),
  );

  const sales = await prisma.user.findMany({
    where: { isSales: true, isActive: true },
    select: {
      id: true,
      _count: {
        select: {
          presurveiProspek: { where: { status: { in: statusAktif } } },
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
