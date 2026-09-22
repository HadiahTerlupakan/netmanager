import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateKegiatanInput,
  IKegiatanRepository,
  KegiatanListFilters,
} from "../domain/ports/IKegiatanRepository";
import type { CreateProspekInput } from "../domain/ports/IProspekRepository";
import { toKegiatanEntity, type KegiatanRow } from "../mappers/kegiatan.mapper";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";

/**
 * Akses data kegiatan presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class KegiatanRepository implements IKegiatanRepository {
  /** Ambil satu halaman kegiatan beserta jumlah totalnya. */
  async findMany(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiKegiatan.findMany({
        where,
        orderBy: { waktuMulai: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiKegiatan.count({ where }),
    ]);

    return {
      items: rows.map((row) => toKegiatanEntity(row as KegiatanRow)),
      total,
    };
  }

  /** Ambil satu kegiatan berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<KegiatanEntity | null> {
    const row = await prisma.presurveiKegiatan.findUnique({ where: { id } });
    return row ? toKegiatanEntity(row as KegiatanRow) : null;
  }

  /** Simpan kegiatan baru tanpa membuat prospek. */
  async create(input: CreateKegiatanInput): Promise<KegiatanEntity> {
    const row = await prisma.presurveiKegiatan.create({ data: input });
    return toKegiatanEntity(row as KegiatanRow);
  }

  /**
   * Simpan kegiatan beserta prospek yang lahir darinya dalam satu transaksi.
   *
   * Keduanya berada di modul yang sama sehingga cukup satu transaksi Prisma —
   * tidak perlu pola kompensasi seperti pada operasi lintas modul.
   */
  async createDenganProspek(
    kegiatan: CreateKegiatanInput,
    prospek: CreateProspekInput,
  ): Promise<{ kegiatan: KegiatanEntity; prospek: ProspekEntity }> {
    return prisma.$transaction(async (tx) => {
      const barisProspek = await tx.presurveiProspek.create({ data: prospek });
      const barisKegiatan = await tx.presurveiKegiatan.create({
        data: { ...kegiatan, prospekId: barisProspek.id },
      });

      return {
        kegiatan: toKegiatanEntity(barisKegiatan as KegiatanRow),
        prospek: toProspekEntity(barisProspek as ProspekRow),
      };
    });
  }

  private bangunFilter(
    filters: KegiatanListFilters,
  ): Prisma.PresurveiKegiatanWhereInput {
    const rentangWaktu =
      filters.dariTanggal || filters.sampaiTanggal
        ? {
            waktuMulai: {
              ...(filters.dariTanggal ? { gte: filters.dariTanggal } : {}),
              ...(filters.sampaiTanggal ? { lte: filters.sampaiTanggal } : {}),
            },
          }
        : {};

    return {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.jenis ? { jenis: filters.jenis } : {}),
      ...(filters.hasil ? { hasil: filters.hasil } : {}),
      ...(filters.prospekId ? { prospekId: filters.prospekId } : {}),
      ...rentangWaktu,
    };
  }
}
