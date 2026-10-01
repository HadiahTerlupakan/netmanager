import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { RencanaEntity } from "../domain/entities/Rencana";
import type {
  BatalRencanaInput,
  CreateRencanaInput,
  IRencanaRepository,
  RencanaListFilters,
  UbahRencanaInput,
} from "../domain/ports/IRencanaRepository";
import {
  tanggalKeKolomDate,
  toRencanaEntity,
  type RencanaRow,
} from "../mappers/rencana.mapper";
import { pastikanTenantTerisi } from "./pastikan-tenant-terisi";

const IDENTITAS = { select: { id: true, name: true, tenantId: true } } as const;

/** Join nama sales, pembuat, dan prospek — dipakai setiap pembacaan rencana. */
const SERTAKAN_RENCANA = {
  sales: IDENTITAS,
  dibuatOleh: IDENTITAS,
  prospek: { select: { nama: true, tenantId: true } },
} satisfies Prisma.PresurveiRencanaInclude;

/** Urutan agenda: per tanggal, lalu jam (tanpa jam di akhir hari), lalu waktu dibuat. */
const URUTAN_AGENDA: Prisma.PresurveiRencanaOrderByWithRelationInput[] = [
  { tanggal: "asc" },
  { jam: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
];

/**
 * Akses data rencana kunjungan.
 *
 * `tenantId` ditulis eksplisit di setiap query (fail-closed), bukan hanya
 * diserahkan ke ekstensi tenant — untuk super admin ekstensi tidak menyaring
 * apa pun (`lib/prisma-extension.ts`). Pola sama dengan `TargetRepository`.
 */
export class RencanaRepository implements IRencanaRepository {
  async findMany(
    filters: RencanaListFilters,
  ): Promise<{ items: RencanaEntity[]; total: number }> {
    pastikanTenantTerisi(filters.tenantId, "Daftar rencana presurvei");
    const where = bangunWhereDaftar(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiRencana.findMany({
        where,
        include: SERTAKAN_RENCANA,
        orderBy: URUTAN_AGENDA,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiRencana.count({ where }),
    ]);

    return {
      items: rows.map((row) => toRencanaEntity(row as RencanaRow)),
      total,
    };
  }

  async findById(id: string): Promise<RencanaEntity | null> {
    if (!id) return null;
    const row = await prisma.presurveiRencana.findUnique({
      where: { id },
      include: SERTAKAN_RENCANA,
    });
    return row ? toRencanaEntity(row as RencanaRow) : null;
  }

  async create(input: CreateRencanaInput): Promise<RencanaEntity> {
    pastikanTenantTerisi(input.tenantId, "Buat rencana presurvei");
    const row = await prisma.presurveiRencana.create({
      data: { ...input, tanggal: tanggalKeKolomDate(input.tanggal) },
      include: SERTAKAN_RENCANA,
    });
    return toRencanaEntity(row as RencanaRow);
  }

  /**
   * `updateMany` dengan `status` di `where` menjaga balapan: rencana yang
   * sudah dilaporkan/dibatalkan di antara pembacaan dan penulisan tidak
   * tersentuh, dan pemanggil menerima null.
   */
  async ubahSelagiTerbuka(
    id: string,
    input: UbahRencanaInput,
  ): Promise<RencanaEntity | null> {
    const { tanggal, ...lainnya } = input;
    const { count } = await prisma.presurveiRencana.updateMany({
      where: { id, status: "DIRENCANAKAN" },
      data: {
        ...lainnya,
        ...(tanggal !== undefined && { tanggal: tanggalKeKolomDate(tanggal) }),
      },
    });
    return count === 0 ? null : this.findById(id);
  }

  async batalkanSelagiTerbuka(
    id: string,
    input: BatalRencanaInput,
  ): Promise<RencanaEntity | null> {
    const { count } = await prisma.presurveiRencana.updateMany({
      where: { id, status: "DIRENCANAKAN" },
      data: {
        status: "BATAL",
        alasanBatal: input.alasan,
        dibatalkanOlehId: input.olehId,
        dibatalkanAt: input.pada,
      },
    });
    return count === 0 ? null : this.findById(id);
  }

  async findUntukRekap(filters: {
    tenantId: string;
    salesIds?: string[];
    dari: string;
    sampai: string;
  }): Promise<RencanaEntity[]> {
    pastikanTenantTerisi(filters.tenantId, "Rekap rencana presurvei");
    const rows = await prisma.presurveiRencana.findMany({
      where: {
        tenantId: filters.tenantId,
        ...(filters.salesIds && { salesId: { in: filters.salesIds } }),
        tanggal: {
          gte: tanggalKeKolomDate(filters.dari),
          lte: tanggalKeKolomDate(filters.sampai),
        },
      },
      include: SERTAKAN_RENCANA,
      orderBy: URUTAN_AGENDA,
    });
    return rows.map((row) => toRencanaEntity(row as RencanaRow));
  }

  async anggotaTim(kepalaSalesId: string, tenantId: string): Promise<string[]> {
    pastikanTenantTerisi(tenantId, "Anggota tim sales");
    const rows = await prisma.user.findMany({
      where: { kepalaSalesId, tenantId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}

/** Terjemahkan filter daftar (termasuk status tampil TERLEWAT) ke `where` Prisma. */
function bangunWhereDaftar(
  filters: RencanaListFilters,
): Prisma.PresurveiRencanaWhereInput {
  const hariIni = tanggalKeKolomDate(filters.hariIni);
  const salesIn = filterSales(filters);

  const where: Prisma.PresurveiRencanaWhereInput = {
    tenantId: filters.tenantId,
    ...(salesIn !== undefined && { salesId: salesIn }),
  };

  const rentangTanggal: Prisma.DateTimeFilter = {
    ...(filters.dari && { gte: tanggalKeKolomDate(filters.dari) }),
    ...(filters.sampai && { lte: tanggalKeKolomDate(filters.sampai) }),
  };

  if (filters.status === "TERLEWAT") {
    where.status = "DIRENCANAKAN";
    rentangTanggal.lt = hariIni;
  } else if (filters.status === "DIRENCANAKAN") {
    where.status = "DIRENCANAKAN";
    rentangTanggal.gte = maksTanggal(rentangTanggal.gte, hariIni);
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (Object.keys(rentangTanggal).length > 0) where.tanggal = rentangTanggal;
  return where;
}

/**
 * Filter `salesId`: lingkup (`salesIds`) selalu membatasi; `salesId` hanya
 * mempersempit di dalamnya — sales di luar lingkup menghasilkan daftar kosong.
 */
function filterSales(
  filters: RencanaListFilters,
): Prisma.StringFilter | string | undefined {
  if (!filters.salesIds) return filters.salesId;
  if (!filters.salesId) return { in: filters.salesIds };
  return { in: filters.salesIds.filter((id) => id === filters.salesId) };
}

function maksTanggal(
  nilai: Prisma.DateTimeFilter["gte"],
  batas: Date,
): Date {
  if (nilai instanceof Date && nilai > batas) return nilai;
  return batas;
}
