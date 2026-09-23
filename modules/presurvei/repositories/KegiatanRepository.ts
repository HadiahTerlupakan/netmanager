import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { RiwayatKegiatanEntity } from "../domain/entities/KegiatanRiwayat";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateKegiatanInput,
  IKegiatanRepository,
  KegiatanListFilters,
  RentangPeriode,
  UbahKegiatanDenganRiwayatInput,
} from "../domain/ports/IKegiatanRepository";
import type { CreateProspekInput } from "../domain/ports/IProspekRepository";
import { toKegiatanEntity, type KegiatanRow } from "../mappers/kegiatan.mapper";
import {
  toRiwayatKegiatanEntity,
  type RiwayatKegiatanRow,
} from "../mappers/kegiatan-riwayat.mapper";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";
import {
  SERTAKAN_PELAKU,
  SERTAKAN_PEMILIK,
  SERTAKAN_PENGUBAH,
} from "./sertakan-sales";

/**
 * Akses data kegiatan presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 * Pengecualiannya join nama sales (`sertakan-sales.ts`): `include` bersarang
 * tidak dijangkau ekstensi, jadi tenant-nya dijaga mapper lewat
 * `namaSalesSatuTenant`.
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
        include: SERTAKAN_PELAKU,
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
    const row = await prisma.presurveiKegiatan.findUnique({
      where: { id },
      include: SERTAKAN_PELAKU,
    });
    return row ? toKegiatanEntity(row as KegiatanRow) : null;
  }

  /** Simpan kegiatan baru tanpa membuat prospek. */
  async create(input: CreateKegiatanInput): Promise<KegiatanEntity> {
    const row = await prisma.presurveiKegiatan.create({
      data: input,
      include: SERTAKAN_PELAKU,
    });
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
      const barisProspek = await tx.presurveiProspek.create({
        data: prospek,
        include: SERTAKAN_PEMILIK,
      });
      const barisKegiatan = await tx.presurveiKegiatan.create({
        data: { ...kegiatan, prospekId: barisProspek.id },
        include: SERTAKAN_PELAKU,
      });

      return {
        kegiatan: toKegiatanEntity(barisKegiatan as KegiatanRow),
        prospek: toProspekEntity(barisProspek as ProspekRow),
      };
    });
  }

  /**
   * Tulis perubahan kegiatan dan jejak auditnya dalam satu transaksi.
   *
   * `updateMany` dengan `updatedAt` di `where` adalah kunci konkurensi
   * optimistis: bila baris sudah tidak pada `versi` (lihat port), tidak ada
   * baris yang cocok, tidak ada yang ditulis, dan service menolak 409.
   * Seberapa lebar jendela yang dijaga ditentukan asal `versi`: versi klien
   * menjaga sejak form dibuka, versi bacaan service hanya di dalam satu
   * request. Pola yang sama dengan `ProspekRepository.tandaiKonversi`
   * (`canvasingId: null` di `where`).
   */
  async ubahDenganRiwayat(
    input: UbahKegiatanDenganRiwayatInput,
  ): Promise<KegiatanEntity | null> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.presurveiKegiatan.updateMany({
        where: { id: input.id, updatedAt: input.versi },
        data: input.nilaiBaru,
      });
      if (count === 0) return null;

      await tx.presurveiKegiatanRiwayat.create({
        data: {
          kegiatanId: input.id,
          tenantId: input.riwayat.tenantId,
          diubahOlehId: input.riwayat.diubahOlehId,
          perubahan: input.riwayat.perubahan as Prisma.InputJsonObject,
        },
      });

      const row = await tx.presurveiKegiatan.findUnique({
        where: { id: input.id },
        include: SERTAKAN_PELAKU,
      });
      return toKegiatanEntity(row as KegiatanRow);
    });
  }

  /** Riwayat perubahan satu kegiatan, terbaru lebih dulu. */
  async findRiwayat(kegiatanId: string): Promise<RiwayatKegiatanEntity[]> {
    const rows = await prisma.presurveiKegiatanRiwayat.findMany({
      where: { kegiatanId },
      orderBy: { diubahPada: "desc" },
      include: SERTAKAN_PENGUBAH,
    });
    return rows.map((row) =>
      toRiwayatKegiatanEntity(row as RiwayatKegiatanRow),
    );
  }

  /** Jumlah kegiatan per pelaku pada satu rentang, berkunci userId. */
  async hitungPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    const hasil = await prisma.presurveiKegiatan.groupBy({
      by: ["userId"],
      where: { waktuMulai: { gte: rentang.mulai, lte: rentang.selesai } },
      _count: { _all: true },
    });

    return Object.fromEntries(
      hasil.map((baris) => [baris.userId, baris._count._all]),
    );
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
