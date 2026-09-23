import { TenantContextError } from "@/lib/prisma-extension";
import { prisma } from "@/modules/database";
import type { PeriodeTarget, TargetEntity } from "../domain/entities/Target";
import type {
  ITargetRepository,
  SimpanTargetInput,
} from "../domain/ports/ITargetRepository";
import { toTargetEntity, type TargetRow } from "../mappers/target.mapper";

/**
 * Akses data target presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant.
 */
export class TargetRepository implements ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  async findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]> {
    const rows = await prisma.presurveiTarget.findMany({
      where: { periodeTahun: periode.tahun, periodeBulan: periode.bulan },
    });
    return rows.map((row) => toTargetEntity(row as TargetRow));
  }

  /**
   * Target seorang sales pada satu periode di satu tenant, null bila belum
   * ditetapkan.
   *
   * `tenantId` ditulis eksplisit: untuk super admin ekstensi tenant tidak
   * menyaring apa pun (`lib/prisma-extension.ts`, `isNonSuperAdminTenant`).
   */
  async findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
    tenantId: string,
  ): Promise<TargetEntity | null> {
    pastikanTenantTerisi(tenantId, "findByUserPeriode");
    const row = await prisma.presurveiTarget.findFirst({
      where: {
        userId,
        periodeTahun: periode.tahun,
        periodeBulan: periode.bulan,
        tenantId,
      },
    });
    return row ? toTargetEntity(row as TargetRow) : null;
  }

  /**
   * Simpan target, menimpa yang sudah ada untuk user dan periode yang sama.
   *
   * `input.tenantId` wajib terisi dan ikut ditulis pada `create`. Nasibnya
   * di `lib/prisma-extension.ts` bergantung pada konteks:
   * - pemanggil biasa: `applyTenantToCreateData` membuang nilai ini dan
   *   menulis tenant konteks (baris 96–102). Service memberi tenant sesi,
   *   dan konteks yang tenantnya berbeda dari sesi sudah dikosongkan lalu
   *   ditolak sebelum sampai sini (`enforceSessionHostMatch`,
   *   `lib/tenant-context.ts`), jadi keduanya sama;
   * - super admin bertenant konteks: nilai eksplisit dipertahankan karena
   *   tidak `undefined` (baris 281–289);
   * - super admin tanpa tenant konteks: ekstensi melewati seluruh injeksi
   *   (baris 227), sehingga nilai eksplisit inilah satu-satunya tenant baris.
   * `update` tidak menyentuh `tenantId`: baris lama sudah bertenant.
   */
  async simpan(input: SimpanTargetInput): Promise<TargetEntity> {
    pastikanTenantTerisi(input.tenantId, "simpan");
    const adaSebelumnya = await this.findByUserPeriode(
      input.userId,
      { tahun: input.periodeTahun, bulan: input.periodeBulan },
      input.tenantId,
    );

    const row = adaSebelumnya
      ? await prisma.presurveiTarget.update({
          where: { id: adaSebelumnya.id },
          data: {
            targetKunjungan: input.targetKunjungan,
            targetProspek: input.targetProspek,
            targetKonversi: input.targetKonversi,
          },
        })
      : await prisma.presurveiTarget.create({ data: input });

    return toTargetEntity(row as TargetRow);
  }
}

/**
 * Fail-closed, pola `SalesRepository.daftarAktif`: `tenantId` kosong berarti
 * "tanpa syarat" bagi Prisma di `where` dan target bertenant null di `create`.
 */
function pastikanTenantTerisi(tenantId: string, operasi: string): void {
  if (tenantId) return;
  throw new TenantContextError(
    "missing-context",
    `Target presurvei ${operasi} diminta tanpa tenantId`,
  );
}
