import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";

/**
 * Akses data prospek presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class ProspekRepository implements IProspekRepository {
  /** Ambil satu halaman prospek beserta jumlah totalnya. */
  async findMany(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiProspek.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiProspek.count({ where }),
    ]);

    return {
      items: rows.map((row) => toProspekEntity(row as ProspekRow)),
      total,
    };
  }

  /** Ambil satu prospek berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<ProspekEntity | null> {
    const row = await prisma.presurveiProspek.findUnique({ where: { id } });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /** Prospek dengan nomor telepon yang sama — dipakai memperingatkan duplikat. */
  async findByNoTelp(noTelp: string): Promise<ProspekEntity[]> {
    const rows = await prisma.presurveiProspek.findMany({
      where: { noTelp },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toProspekEntity(row as ProspekRow));
  }

  /** Prospek yang lahir dari satu pendaftaran publik, null bila belum ada. */
  async findByRegistrationId(
    registrationId: string,
  ): Promise<ProspekEntity | null> {
    const row = await prisma.presurveiProspek.findUnique({
      where: { registrationId },
    });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /** Simpan prospek baru. */
  async create(input: CreateProspekInput): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.create({ data: input });
    return toProspekEntity(row as ProspekRow);
  }

  /** Perbarui prospek yang sudah ada. */
  async update(id: string, input: UpdateProspekInput): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.update({
      where: { id },
      data: input,
    });
    return toProspekEntity(row as ProspekRow);
  }

  private bangunFilter(
    filters: ProspekListFilters,
  ): Prisma.PresurveiProspekWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sumber ? { sumber: filters.sumber } : {}),
      ...(filters.pemilikId ? { pemilikId: filters.pemilikId } : {}),
      ...(filters.search
        ? {
            OR: [
              { nama: { contains: filters.search, mode: "insensitive" } },
              { noTelp: { contains: filters.search, mode: "insensitive" } },
              { alamat: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
}
