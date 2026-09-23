import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import { TenantContextError } from "@/lib/prisma-extension";
import type { AksesTenantPresurvei } from "../domain/akses-tenant";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import type { RentangPeriode } from "../domain/ports/IKegiatanRepository";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";
import { SERTAKAN_PEMILIK } from "./sertakan-sales";

/**
 * Batas jumlah prospek sebobot nomor yang diambil saat memeriksa duplikat.
 *
 * Yang dibutuhkan hanya beberapa contoh untuk ditampilkan sebagai peringatan,
 * sementara nomor bersama — nomor kios, nomor kantor, atau placeholder yang
 * dipakai berulang — bisa menempel pada ratusan prospek. Kolom `noTelp` juga
 * belum ber-index, jadi membiarkannya tanpa batas berarti pemindaian penuh
 * pada jalur yang dilewati setiap pembuatan prospek.
 */
const BATAS_PERIKSA_DUPLIKAT = 10;

/**
 * Akses data prospek presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 * Pengecualiannya join nama sales (`sertakan-sales.ts`): `include` bersarang
 * tidak dijangkau ekstensi, jadi tenant-nya dijaga mapper lewat
 * `namaSalesSatuTenant`.
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
        include: SERTAKAN_PEMILIK,
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
    const row = await prisma.presurveiProspek.findUnique({
      where: { id },
      include: SERTAKAN_PEMILIK,
    });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /**
   * Satu prospek dalam cakupan tenant pemanggil, null bila tidak ada atau di
   * luar cakupan.
   *
   * Cakupan satu tenant menulis `tenantId` eksplisit di `where` — isolasi di
   * repository, tidak diserahkan ke ekstensi saja — dan menolak `tenantId`
   * kosong, yang bagi Prisma berarti "tanpa syarat". Lintas tenant (super
   * admin) mencari lewat id saja.
   */
  async findByIdDalamCakupan(
    id: string,
    akses: AksesTenantPresurvei,
  ): Promise<ProspekEntity | null> {
    if (akses.jenis === "lintas-tenant") return this.findById(id);

    if (!akses.tenantId) {
      throw new TenantContextError(
        "missing-context",
        "Prospek presurvei dalam cakupan diminta tanpa tenantId",
      );
    }

    const row = await prisma.presurveiProspek.findFirst({
      where: { id, tenantId: akses.tenantId },
      include: SERTAKAN_PEMILIK,
    });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /** Prospek dengan nomor telepon yang sama — dipakai memperingatkan duplikat. */
  async findByNoTelp(noTelp: string): Promise<ProspekEntity[]> {
    const rows = await prisma.presurveiProspek.findMany({
      where: { noTelp },
      orderBy: { createdAt: "desc" },
      take: BATAS_PERIKSA_DUPLIKAT,
      include: SERTAKAN_PEMILIK,
    });
    return rows.map((row) => toProspekEntity(row as ProspekRow));
  }

  /** Prospek yang lahir dari satu pendaftaran publik, null bila belum ada. */
  async findByRegistrationId(
    registrationId: string,
  ): Promise<ProspekEntity | null> {
    const row = await prisma.presurveiProspek.findUnique({
      where: { registrationId },
      include: SERTAKAN_PEMILIK,
    });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /** Simpan prospek baru. */
  async create(input: CreateProspekInput): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.create({
      data: input,
      include: SERTAKAN_PEMILIK,
    });
    return toProspekEntity(row as ProspekRow);
  }

  /** Perbarui prospek yang sudah ada. */
  async update(id: string, input: UpdateProspekInput): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.update({
      where: { id },
      data: input,
      include: SERTAKAN_PEMILIK,
    });
    return toProspekEntity(row as ProspekRow);
  }

  /**
   * Tandai prospek sebagai terkonversi, hanya bila ia belum pernah ditandai.
   *
   * `canvasingId: null` di `where` membuat penulisan ini titik serialisasi.
   * Pemeriksaan di domain berjalan sebelum canvasing dibuat, jadi dua
   * permintaan bersamaan bisa sama-sama melewatinya; hanya satu yang boleh
   * menang di sini.
   */
  async tandaiKonversi(
    id: string,
    canvasingId: string,
  ): Promise<ProspekEntity | null> {
    try {
      const row = await prisma.presurveiProspek.update({
        where: { id, canvasingId: null },
        data: { canvasingId, konversiAt: new Date() },
        include: SERTAKAN_PEMILIK,
      });
      return toProspekEntity(row as ProspekRow);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) return null;
      throw error;
    }
  }

  /** Jumlah prospek baru per pemilik pada satu rentang, berkunci pemilikId. */
  async hitungBaruPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    return this.hitungPerPemilik({
      createdAt: { gte: rentang.mulai, lte: rentang.selesai },
    });
  }

  /** Jumlah prospek terkonversi per pemilik pada satu rentang. */
  async hitungKonversiPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    return this.hitungPerPemilik({
      konversiAt: { gte: rentang.mulai, lte: rentang.selesai },
    });
  }

  private async hitungPerPemilik(
    where: Prisma.PresurveiProspekWhereInput,
  ): Promise<Record<string, number>> {
    const hasil = await prisma.presurveiProspek.groupBy({
      by: ["pemilikId"],
      // Prospek tak bertuan tidak dihitung ke siapa pun; ia muncul di daftar
      // "Belum ditugaskan", bukan di laporan pencapaian seseorang.
      where: { ...where, pemilikId: { not: null } },
      _count: { _all: true },
    });

    return Object.fromEntries(
      hasil
        .filter((baris) => baris.pemilikId !== null)
        .map((baris) => [baris.pemilikId as string, baris._count._all]),
    );
  }

  /**
   * Klausa pemilik: `pemilikId` yang terisi selalu menang atas `tanpaPemilik`.
   *
   * Route mengisi `pemilikId` dengan id sesi untuk sales lapangan
   * (`app/api/presurvei/prospek/route.ts`). Bila `tanpaPemilik` boleh
   * menimpanya menjadi `null`, sales itu menerima seluruh prospek tak bertuan
   * milik tenant. Route juga menolak `tanpaPemilik=true` dari pemanggil itu
   * (403) dan membuang param-nya; aturan di sini lapis terakhir, juga untuk
   * pemanggil lain dari repository ini.
   */
  private bangunFilterPemilik(
    filters: ProspekListFilters,
  ): Prisma.PresurveiProspekWhereInput {
    if (filters.pemilikId) return { pemilikId: filters.pemilikId };
    if (filters.tanpaPemilik) return { pemilikId: null };
    return {};
  }

  private bangunFilter(
    filters: ProspekListFilters,
  ): Prisma.PresurveiProspekWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sumber ? { sumber: filters.sumber } : {}),
      ...this.bangunFilterPemilik(filters),
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
