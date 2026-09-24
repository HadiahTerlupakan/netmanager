import { prisma } from "@/modules/database";
import type { KegiatanJenis } from "../domain/entities/Kegiatan";
import type { ProspekStatus } from "../domain/entities/Prospek";
import type { RentangPeriode } from "../domain/ports/IKegiatanRepository";
import type { IRingkasanSalesRepository } from "../domain/ports/IRingkasanSalesRepository";
import { daftarStatusBebanAktif } from "../domain/prospek-rules";
import type { ProspekSentuhan } from "../domain/ringkasan-sales";
import { pastikanTenantTerisi } from "./pastikan-tenant-terisi";

/**
 * Batas prospek aktif yang diperiksa untuk "Perlu di-follow-up".
 *
 * Diambil yang `updatedAt`-nya terlama. Hasil tepat selama seorang sales
 * memegang tidak lebih dari batas ini; di atasnya prospek yang barisnya
 * baru berubah tapi belum pernah di-follow-up bisa terlewat.
 */
export const BATAS_PROSPEK_AKTIF_DIPERIKSA = 200;

/**
 * Akses data baca-saja untuk ringkasan Beranda sales.
 *
 * `tenantId` ditulis eksplisit di setiap `where`, tidak diserahkan ke
 * ekstensi saja (pola `TargetRepository.findByUserPeriode`).
 */
export class RingkasanSalesRepository implements IRingkasanSalesRepository {
  /** Jumlah kegiatan pemanggil per jenis dalam satu rentang. */
  async hitungKegiatanPerJenis(
    userId: string,
    rentang: RentangPeriode,
    tenantId: string,
  ): Promise<Partial<Record<KegiatanJenis, number>>> {
    pastikanTenantTerisi(
      tenantId,
      "Ringkasan presurvei hitungKegiatanPerJenis",
    );
    const hasil = await prisma.presurveiKegiatan.groupBy({
      by: ["jenis"],
      where: {
        userId,
        tenantId,
        waktuMulai: { gte: rentang.mulai, lte: rentang.selesai },
      },
      _count: { _all: true },
    });
    return Object.fromEntries(
      hasil.map((baris) => [baris.jenis, baris._count._all]),
    ) as Partial<Record<KegiatanJenis, number>>;
  }

  /** Prospek beban aktif milik pemanggil, `updatedAt` terlama lebih dulu. */
  async daftarProspekAktif(
    pemilikId: string,
    tenantId: string,
  ): Promise<ProspekSentuhan[]> {
    pastikanTenantTerisi(tenantId, "Ringkasan presurvei daftarProspekAktif");
    const rows = await prisma.presurveiProspek.findMany({
      where: { pemilikId, tenantId, status: { in: daftarStatusBebanAktif() } },
      orderBy: { updatedAt: "asc" },
      take: BATAS_PROSPEK_AKTIF_DIPERIKSA,
      select: {
        id: true,
        nama: true,
        noTelp: true,
        status: true,
        updatedAt: true,
      },
    });
    return rows.map((baris) => ({
      id: baris.id,
      nama: baris.nama,
      noTelp: baris.noTelp,
      status: baris.status as ProspekStatus,
      updatedAt: baris.updatedAt,
    }));
  }

  /** Waktu mulai kegiatan terakhir per prospek. */
  async waktuKegiatanTerakhir(
    prospekIds: readonly string[],
    tenantId: string,
  ): Promise<Record<string, Date>> {
    pastikanTenantTerisi(tenantId, "Ringkasan presurvei waktuKegiatanTerakhir");
    if (prospekIds.length === 0) return {};
    const hasil = await prisma.presurveiKegiatan.groupBy({
      by: ["prospekId"],
      where: { prospekId: { in: [...prospekIds] }, tenantId },
      _max: { waktuMulai: true },
    });
    return Object.fromEntries(
      hasil
        .filter(
          (baris) => baris.prospekId !== null && baris._max.waktuMulai !== null,
        )
        .map((baris) => [
          baris.prospekId as string,
          baris._max.waktuMulai as Date,
        ]),
    );
  }
}
