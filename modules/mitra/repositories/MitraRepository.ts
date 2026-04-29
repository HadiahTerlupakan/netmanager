import { prisma, prismaBilling } from "@/modules/database";
import { prismaMitra } from "@/lib/prisma-mitra";
import { MitraType, type Prisma } from "@prisma/client-mitra";
import { createInsensitiveContainsFilter } from "@/modules/finance";
import type {
  CreateMitraDTO,
  MitraFilters,
  UpdateMitraDTO,
} from "../dto/MitraDTO";
import type {
  IMitraRepository,
  CreateMitraRecord,
  FeePelangganStatsQuery,
  SaveFaceVerificationRecord,
  UpdateMitraRecord,
} from "../domain/ports/IMitraRepository";
import {
  toFaceVerificationLogEntity,
  toMitraEntity,
  toMitraPushTokenEntity,
  toMitraStatsEntity,
  toMitraSummaryEntity,
} from "../mappers/MitraDomainMapper";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MONTH_KEY_LENGTH = 7;
const MILLISECOND_OFFSET = 1;
const EARNING_TYPE = "EARNING";
const FEE_PELANGGAN_REFERENCE_PREFIX = "PAYOUT-FEE-";

export class MitraRepository implements IMitraRepository {
  /** Menghapus push token milik mitra yang tidak valid. */
  async clearPushTokens(tokens: string[]) {
    return prismaMitra.mitra.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
  }

  /** Mengambil daftar mitra berdasarkan token push. */
  async findManyWithPushToken(tokens: string[]) {
    const mitras = await prismaMitra.mitra.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });

    return mitras.map(toMitraPushTokenEntity);
  }

  /** Mengambil push token mitra berdasarkan id. */
  async findPushTokenById(id: string) {
    return prismaMitra.mitra.findUnique({
      where: { id },
      select: { pushToken: true },
    });
  }

  /** Mengambil daftar mitra bertoken push dari kumpulan id. */
  async findManyWithPushTokenByIds(ids: string[]) {
    const mitras = await prismaMitra.mitra.findMany({
      where: { id: { in: ids }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });

    return mitras.map(toMitraPushTokenEntity);
  }

  /** Mengambil mitra sederhana berdasarkan id. */
  async findByIdSimple(id: string, tenantId?: string) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
      include: { mitraWallet: true },
    });

    return mitra ? toMitraEntity(mitra) : null;
  }

  /** Mengambil seluruh id mitra pada site tertentu. */
  async findIdsBySite(siteId: string) {
    const mitras = await prismaMitra.mitra.findMany({
      where: { siteId },
      select: { id: true },
    });

    return mitras.map((mitra) => mitra.id);
  }

  /** Mengambil ringkasan mitra untuk kebutuhan canvasing. */
  async findCanvasingSummary(id: string) {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        mitraType: true,
        siteId: true,
      },
    });

    return mitra ? toMitraSummaryEntity(mitra) : null;
  }

  /** Mengambil data mitra aktif untuk ID card publik. */
  async findIdCardById(id: string) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: { id, isActive: true },
      select: this.getMitraIdCardSelect(),
    });

    if (!mitra) {
      return null;
    }

    const site = await this.findSiteName(mitra.siteId);
    return { ...mitra, site };
  }

  /** Mengambil nama mitra untuk metadata ID card. */
  findIdCardTitleById(id: string) {
    return prismaMitra.mitra.findUnique({
      where: { id },
      select: { name: true },
    });
  }

  /** Mengambil daftar mitra dengan filter dan paginasi. */
  async findAll(
    filters: MitraFilters,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ) {
    const skip = (page - 1) * limit;
    const where = this.buildMitraWhere(filters);
    const [mitras, total] = await Promise.all([
      prismaMitra.mitra.findMany({
        where,
        select: this.getMitraListSelect(),
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prismaMitra.mitra.count({ where }),
    ]);

    return {
      mitras: mitras.map(toMitraEntity),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Mengambil detail mitra berdasarkan id. */
  async findById(id: string, tenantId?: string) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
      include: {
        mitraWallet: true,
        faceVerificationLogs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    return mitra ? toMitraEntity(mitra) : null;
  }

  /** Mengambil statistik agregat mitra. */
  async getStats(tenantId?: string) {
    const mitraWhere = tenantId ? { tenantId } : {};
    const walletWhere = tenantId ? { mitra: { tenantId } } : {};
    const [totalTeknisi, totalSales, totalActive, totalWalletBalance] =
      await Promise.all([
        prismaMitra.mitra.count({
          where: { ...mitraWhere, mitraType: "MITRA_TEKNISI" },
        }),
        prismaMitra.mitra.count({
          where: { ...mitraWhere, mitraType: "MITRA_SALES" },
        }),
        prismaMitra.mitra.count({ where: { ...mitraWhere, isActive: true } }),
        prismaMitra.mitraWallet.aggregate({
          where: walletWhere,
          _sum: { balance: true },
        }),
      ]);

    return toMitraStatsEntity({
      totalTeknisi,
      totalSales,
      totalActive,
      totalBalance: totalWalletBalance._sum.balance?.toNumber() || 0,
    });
  }

  /** Membuat data mitra baru dan wallet awalnya. */
  async createMitra(record: CreateMitraRecord) {
    await prismaMitra.$transaction(async (tx) => {
      await tx.mitra.create({
        data: this.buildCreateMitraData(
          record.id,
          record.passwordHash,
          record.payload,
        ),
      });
      await this.ensureWalletExistsTx(tx, record.id);
    });
  }

  /** Memperbarui data mitra dan memastikan wallet tetap tersedia. */
  async updateMitra(record: UpdateMitraRecord) {
    await prismaMitra.$transaction(async (tx) => {
      await tx.mitra.update({
        where: { id: record.id },
        data: this.buildUpdateMitraData(record.payload, record.passwordHash),
      });
      await this.ensureWalletExistsTx(tx, record.id);
    });
  }

  /** Menonaktifkan mitra secara soft delete. */
  async softDeleteMitra(id: string) {
    await prismaMitra.mitra.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Mengambil log verifikasi wajah dengan paginasi. */
  async getFaceVerificationLogs(
    mitraId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prismaMitra.faceVerificationLog.findMany({
        where: { mitraId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaMitra.faceVerificationLog.count({ where: { mitraId } }),
    ]);

    return {
      logs: logs.map(toFaceVerificationLogEntity),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Mengambil jumlah penarikan pending milik mitra. */
  async countPendingWithdrawals(mitraId: string, tenantId?: string) {
    return prismaMitra.withdrawRequest.count({
      where: {
        mitraId,
        status: "PENDING",
        ...(tenantId && { mitra: { tenantId } }),
      },
    });
  }

  /** Mengambil statistik fee pelanggan bulanan mitra sales. */
  async getFeePelangganStats(query: FeePelangganStatsQuery) {
    const yesterdayEnd = this.createYesterdayEnd(query.today);
    const currentMonthKey = query.monthStart
      .toISOString()
      .substring(0, MONTH_KEY_LENGTH);
    const invoices = await prismaBilling.mixRadiusInvoice.findMany({
      where: {
        status: "PAID",
        issuedDate: { gte: query.monthStart, lte: yesterdayEnd },
        ownerName: { in: query.ownerNames },
      },
      select: { username: true },
    });
    const activeCustomers = new Set(invoices.map((invoice) => invoice.username))
      .size;
    const totalFeePelanggan = activeCustomers * query.feeRate;
    const remainingFeePelanggan = await this.getRemainingFeePelanggan({
      mitraId: query.mitraId,
      currentMonthKey,
      totalFeePelanggan,
    });

    return {
      activeCustomers,
      totalFeePelanggan,
      remainingFeePelanggan,
      unpaidCustomersCount: this.getUnpaidCustomersCount(
        remainingFeePelanggan,
        query.feeRate,
      ),
    };
  }

  /** Menyimpan hasil verifikasi wajah mitra. */
  async saveFaceVerification(record: SaveFaceVerificationRecord) {
    await prismaMitra.$transaction([
      prismaMitra.mitra.update({
        where: { id: record.mitraId },
        data: {
          requiresFaceVerification: false,
          lastFaceVerification: new Date(),
          fotoDiri: record.photoUrl,
        },
      }),
      prismaMitra.faceVerificationLog.create({
        data: {
          mitraId: record.mitraId,
          photoUrl: record.photoUrl,
        },
      }),
    ]);
  }

  private buildMitraWhere(filters: MitraFilters): Prisma.MitraWhereInput {
    return {
      ...(filters.employeeType && {
        mitraType: filters.employeeType as Prisma.EnumMitraTypeFilter,
      }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.siteId && { siteId: filters.siteId }),
      ...(filters.tenantId && { tenantId: filters.tenantId }),
      ...(filters.search && {
        OR: [
          { name: createInsensitiveContainsFilter(filters.search) },
          { email: createInsensitiveContainsFilter(filters.search) },
          { phone: createInsensitiveContainsFilter(filters.search) },
        ],
      }),
    };
  }

  private createYesterdayEnd(today: Date) {
    const yesterdayEnd = new Date(today);
    yesterdayEnd.setMilliseconds(-MILLISECOND_OFFSET);
    return yesterdayEnd;
  }

  private async getRemainingFeePelanggan(input: {
    mitraId: string;
    currentMonthKey: string;
    totalFeePelanggan: number;
  }) {
    const syncedFees = await prismaMitra.mitraTransaction.aggregate({
      where: {
        wallet: { mitraId: input.mitraId },
        type: EARNING_TYPE,
        referenceId: {
          startsWith: `${FEE_PELANGGAN_REFERENCE_PREFIX}${input.currentMonthKey}-`,
        },
      },
      _sum: { amount: true },
    });
    const totalSynced = Number(syncedFees._sum.amount || 0);
    return Math.max(0, input.totalFeePelanggan - totalSynced);
  }

  private getUnpaidCustomersCount(
    remainingFeePelanggan: number,
    feeRate: number,
  ) {
    if (feeRate <= 0) return 0;
    return Math.floor(remainingFeePelanggan / feeRate);
  }

  private getMitraIdCardSelect() {
    return {
      id: true,
      name: true,
      mitraType: true,
      nik: true,
      fotoDiri: true,
      phone: true,
      createdAt: true,
      siteId: true,
    } as const;
  }

  private async findSiteName(siteId: string | null) {
    if (!siteId) {
      return null;
    }

    return prisma.sites.findUnique({
      where: { id: siteId },
      select: { name: true },
    });
  }

  private getMitraListSelect() {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      mitraType: true,
      isActive: true,
      siteId: true,
      tenantId: true,
      mitraRateWoPsb: true,
      mitraRateWoMaintenance: true,
      mitraRateCanvasing: true,
      mitraRateFeePelanggan: true,
      enableFeePelanggan: true,
      mixradiusOwnerNames: true,
      bankName: true,
      bankAccountNo: true,
      bankAccountName: true,
      targetHarian: true,
      minWithdrawal: true,
      garansiHari: true,
      slaGaransiJam: true,
      penaltyPsb: true,
      penaltyMaintenance: true,
      nik: true,
      tempatLahir: true,
      tanggalLahir: true,
      alamat: true,
      latitudeRumah: true,
      longitudeRumah: true,
      fotoDiri: true,
      fotoKtp: true,
      fotoSim: true,
      fotoKk: true,
      requiresFaceVerification: true,
      lastFaceVerification: true,
      createdAt: true,
      mitraWallet: true,
    } as const;
  }

  private buildCreateMitraData(
    id: string,
    passwordHash: string,
    payload: CreateMitraDTO,
  ): Prisma.MitraUncheckedCreateInput {
    return {
      id,
      name: payload.name,
      email: payload.email,
      passwordHash,
      phone: payload.phone,
      mitraType: this.resolveMitraType(payload.employeeType),
      siteId: payload.siteId,
      tenantId: payload.tenantId,
      mitraRateWoPsb: payload.mitraRateWoPsb,
      mitraRateWoMaintenance: payload.mitraRateWoMaintenance,
      mitraRateCanvasing: payload.mitraRateCanvasing,
      mitraRateFeePelanggan: payload.mitraRateFeePelanggan,
      enableFeePelanggan: payload.enableFeePelanggan ?? false,
      bankName: payload.bankName,
      bankAccountNo: payload.bankAccountNo,
      bankAccountName: payload.bankAccountName,
      targetHarian: payload.targetHarian,
      minWithdrawal: payload.minWithdrawal,
      mixradiusOwnerNames: payload.mixradiusOwnerNames || [],
      garansiHari: payload.garansiHari,
      slaGaransiJam: payload.slaGaransiJam,
      penaltyPsb: payload.penaltyPsb,
      penaltyMaintenance: payload.penaltyMaintenance,
      nik: payload.nik,
      tempatLahir: payload.tempatLahir,
      tanggalLahir: payload.tanggalLahir
        ? new Date(payload.tanggalLahir)
        : undefined,
      alamat: payload.alamat,
      latitudeRumah: payload.latitudeRumah,
      longitudeRumah: payload.longitudeRumah,
      fotoDiri: payload.fotoDiri,
      fotoKtp: payload.fotoKtp,
      fotoSim: payload.fotoSim,
      fotoKk: payload.fotoKk,
      requiresFaceVerification: payload.requiresFaceVerification ?? false,
      isActive: true,
    };
  }

  private buildUpdateMitraData(
    payload: UpdateMitraDTO,
    passwordHash?: string,
  ): Prisma.MitraUncheckedUpdateInput {
    const mitraType = payload.employeeType
      ? this.resolveMitraType(payload.employeeType)
      : undefined;
    return {
      ...(payload.name && { name: payload.name }),
      ...(payload.email && { email: payload.email }),
      ...(passwordHash && { passwordHash }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(mitraType && { mitraType }),
      ...(payload.siteId !== undefined && { siteId: payload.siteId }),
      ...(payload.mitraRateWoPsb !== undefined && {
        mitraRateWoPsb: payload.mitraRateWoPsb,
      }),
      ...(payload.mitraRateWoMaintenance !== undefined && {
        mitraRateWoMaintenance: payload.mitraRateWoMaintenance,
      }),
      ...(payload.mitraRateCanvasing !== undefined && {
        mitraRateCanvasing: payload.mitraRateCanvasing,
      }),
      ...(payload.mitraRateFeePelanggan !== undefined && {
        mitraRateFeePelanggan: payload.mitraRateFeePelanggan,
      }),
      ...(payload.enableFeePelanggan !== undefined && {
        enableFeePelanggan: payload.enableFeePelanggan,
      }),
      ...(payload.mixradiusOwnerNames !== undefined && {
        mixradiusOwnerNames: payload.mixradiusOwnerNames,
      }),
      ...(payload.bankName !== undefined && { bankName: payload.bankName }),
      ...(payload.bankAccountNo !== undefined && {
        bankAccountNo: payload.bankAccountNo,
      }),
      ...(payload.bankAccountName !== undefined && {
        bankAccountName: payload.bankAccountName,
      }),
      ...(payload.targetHarian !== undefined && {
        targetHarian: payload.targetHarian,
      }),
      ...(payload.minWithdrawal !== undefined && {
        minWithdrawal: payload.minWithdrawal,
      }),
      ...(payload.garansiHari !== undefined && {
        garansiHari: payload.garansiHari,
      }),
      ...(payload.slaGaransiJam !== undefined && {
        slaGaransiJam: payload.slaGaransiJam,
      }),
      ...(payload.penaltyPsb !== undefined && {
        penaltyPsb: payload.penaltyPsb,
      }),
      ...(payload.penaltyMaintenance !== undefined && {
        penaltyMaintenance: payload.penaltyMaintenance,
      }),
      ...(payload.nik !== undefined && { nik: payload.nik }),
      ...(payload.tempatLahir !== undefined && {
        tempatLahir: payload.tempatLahir,
      }),
      ...(payload.tanggalLahir !== undefined && {
        tanggalLahir: payload.tanggalLahir
          ? new Date(payload.tanggalLahir)
          : null,
      }),
      ...(payload.alamat !== undefined && { alamat: payload.alamat }),
      ...(payload.latitudeRumah !== undefined && {
        latitudeRumah: payload.latitudeRumah,
      }),
      ...(payload.longitudeRumah !== undefined && {
        longitudeRumah: payload.longitudeRumah,
      }),
      ...(payload.fotoDiri !== undefined && { fotoDiri: payload.fotoDiri }),
      ...(payload.fotoKtp !== undefined && { fotoKtp: payload.fotoKtp }),
      ...(payload.fotoSim !== undefined && { fotoSim: payload.fotoSim }),
      ...(payload.fotoKk !== undefined && { fotoKk: payload.fotoKk }),
      ...(payload.requiresFaceVerification !== undefined && {
        requiresFaceVerification: payload.requiresFaceVerification,
      }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
    };
  }

  private resolveMitraType(employeeType: string): MitraType {
    return employeeType === "MITRA_SALES"
      ? MitraType.MITRA_SALES
      : MitraType.MITRA_TEKNISI;
  }

  private async ensureWalletExistsTx(
    tx: Prisma.TransactionClient,
    mitraId: string,
  ) {
    const wallet = await tx.mitraWallet.findFirst({ where: { mitraId } });
    if (!wallet) {
      await tx.mitraWallet.create({ data: { mitraId } });
    }
  }
}

let instance: IMitraRepository | null = null;

export function getMitraRepository(): IMitraRepository {
  if (!instance) {
    instance = new MitraRepository();
  }

  return instance;
}
