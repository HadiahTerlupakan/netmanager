import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { IklanEntity } from "../domain/entities/Iklan";
import type {
  CreateIklanInput,
  IIklanRepository,
  IklanListFilters,
  UpdateIklanInput,
} from "../domain/ports/IIklanRepository";
import { toIklanEntity, type IklanRow } from "../mappers/iklan.mapper";

/**
 * Akses data iklan presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class IklanRepository implements IIklanRepository {
  /** Ambil satu halaman iklan beserta jumlah totalnya. */
  async findMany(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiIklan.findMany({
        where,
        orderBy: { tanggalMulai: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiIklan.count({ where }),
    ]);

    return { items: rows.map((row) => toIklanEntity(row as IklanRow)), total };
  }

  /** Ambil satu iklan berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<IklanEntity | null> {
    const row = await prisma.presurveiIklan.findUnique({ where: { id } });
    return row ? toIklanEntity(row as IklanRow) : null;
  }

  /**
   * Iklan dengan kode kampanye tertentu.
   *
   * Memakai `findFirst`, bukan `findUnique`: kodenya unik per tenant, dan
   * ekstensi isolasi menambahkan penyaring tenant pada query ini.
   */
  async findByKode(kode: string): Promise<IklanEntity | null> {
    const row = await prisma.presurveiIklan.findFirst({ where: { kode } });
    return row ? toIklanEntity(row as IklanRow) : null;
  }

  /** Simpan iklan baru. */
  async create(input: CreateIklanInput): Promise<IklanEntity> {
    const row = await prisma.presurveiIklan.create({ data: input });
    return toIklanEntity(row as IklanRow);
  }

  /** Perbarui iklan yang sudah ada. */
  async update(id: string, input: UpdateIklanInput): Promise<IklanEntity> {
    const row = await prisma.presurveiIklan.update({
      where: { id },
      data: input,
    });
    return toIklanEntity(row as IklanRow);
  }

  private bangunFilter(
    filters: IklanListFilters,
  ): Prisma.PresurveiIklanWhereInput {
    return {
      ...(filters.channel ? { channel: filters.channel } : {}),
      // Perbandingan eksplisit terhadap undefined: `isAktif: false` adalah
      // filter yang sah dan tidak boleh hilang karena dianggap falsy.
      ...(filters.isAktif === undefined ? {} : { isAktif: filters.isAktif }),
      ...(filters.search
        ? {
            OR: [
              { nama: { contains: filters.search, mode: "insensitive" } },
              { kode: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
}
