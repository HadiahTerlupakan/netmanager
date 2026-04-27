import { prismaMitra } from "@/lib/prisma-mitra";
import { Prisma, WithdrawStatus } from "@prisma/client-mitra";
import { createInsensitiveContainsFilter } from "@/modules/finance";
import type { MitraFilters, MitraWithDetails } from "../dto/MitraDTO";

export class MitraRepository {
  async clearPushTokens(tokens: string[]) {
    return prismaMitra.mitra.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
  }

  async findManyWithPushToken(
    tokens: string[],
  ): Promise<Array<{ id: string; pushToken: string | null }>> {
    return prismaMitra.mitra.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });
  }

  async findPushTokenById(
    id: string,
  ): Promise<{ pushToken: string | null } | null> {
    return prismaMitra.mitra.findUnique({
      where: { id },
      select: { pushToken: true },
    });
  }

  async findManyWithPushTokenByIds(
    ids: string[],
  ): Promise<Array<{ id: string; pushToken: string | null }>> {
    return prismaMitra.mitra.findMany({
      where: {
        id: { in: ids },
        pushToken: { not: null },
      },
      select: { id: true, pushToken: true },
    });
  }

  async findByIdSimple(id: string) {
    return prismaMitra.mitra.findUnique({ where: { id } });
  }

  async findIdsBySite(siteId: string): Promise<string[]> {
    const mitras = await prismaMitra.mitra.findMany({
      where: { siteId },
      select: { id: true },
    });

    return mitras.map((mitra) => mitra.id);
  }

  async findCanvasingSummary(id: string) {
    return prismaMitra.mitra.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        mitraType: true,
        siteId: true,
      },
    });
  }

  /**
   * Get all mitra users with filters and pagination
   */
  async findAll(filters: MitraFilters, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.MitraWhereInput = {
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

    const [mitras, total] = await Promise.all([
      prismaMitra.mitra.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          mitraType: true,
          isActive: true,
          mitraRateWoPsb: true,
          mitraRateWoMaintenance: true,
          mitraRateCanvasing: true,
          bankName: true,
          bankAccountName: true,
          targetHarian: true,
          minWithdrawal: true,
          garansiHari: true,
          slaGaransiJam: true,
          penaltyPsb: true,
          penaltyMaintenance: true,
          mitraRateFeePelanggan: true,
          enableFeePelanggan: true,
          mixradiusOwnerNames: true,
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
          siteId: true,
          // sites: { select: { name: true } }, // Removed due to Cross-DB
          mitraWallet: {
            select: {
              id: true,
              balance: true,
              totalEarnings: true,
              totalWithdrawn: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prismaMitra.mitra.count({ where }),
    ]);

    return {
      mitras: mitras as unknown as MitraWithDetails[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single mitra by ID
   */
  async findById(id: string, tenantId?: string) {
    return prismaMitra.mitra.findFirst({
      where: {
        id,
        ...(tenantId && { tenantId }),
      },
      include: {
        // sites: { select: { id: true, name: true } }, // Cross-DB relation removed
        mitraWallet: {
          select: {
            id: true,
            balance: true,
            totalEarnings: true,
            totalWithdrawn: true,
          },
        },
        faceVerificationLogs: {
          orderBy: { createdAt: "desc" as const },
          take: 5,
        },
      },
    });
  }

  /**
   * Get mitra stats (totals by type)
   */
  async getStats(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const [totalTeknisi, totalSales, totalActive, totalWalletBalance] =
      await Promise.all([
        prismaMitra.mitra.count({
          where: { ...where, mitraType: "MITRA_TEKNISI" },
        }),
        prismaMitra.mitra.count({
          where: { ...where, mitraType: "MITRA_SALES" },
        }),
        prismaMitra.mitra.count({ where: { ...where, isActive: true } }),
        prismaMitra.mitraWallet.aggregate({
          where: { mitra: { tenantId } },
          _sum: { balance: true },
        }),
      ]);

    return {
      totalTeknisi,
      totalSales,
      totalActive,
      totalBalance: totalWalletBalance._sum.balance || 0,
    };
  }

  /**
   * Create mitra wallet for a mitra
   */
  async createWallet(mitraId: string) {
    return prismaMitra.mitraWallet.create({
      data: { mitraId },
    });
  }

  /**
   * Get wallet by mitra ID
   */
  async getWalletByUserId(mitraId: string, tenantId?: string) {
    return prismaMitra.mitraWallet.findFirst({
      where: {
        mitraId,
        ...(tenantId && { mitra: { tenantId } }),
      },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        withdrawals: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  }

  /**
   * Get wallet transactions with pagination
   */
  async getTransactions(
    walletId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prismaMitra.mitraTransaction.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaMitra.mitraTransaction.count({ where: { walletId } }),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get withdraw requests with pagination
   */
  async getWithdrawRequests(filters: {
    mitraId?: string;
    status?: string;
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    const { mitraId, status, page = 1, limit = 20, tenantId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.WithdrawRequestWhereInput = {
      ...(mitraId && { mitraId }),
      ...(status && { status: status as WithdrawStatus }),
      ...(tenantId && { mitra: { tenantId } }),
    };

    const [requests, total] = await Promise.all([
      prismaMitra.withdrawRequest.findMany({
        where,
        include: {
          mitra: {
            select: { id: true, name: true, email: true, mitraType: true },
          },
          // processedBy: { select: { id: true, name: true } }, // Cross-DB relation removed
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaMitra.withdrawRequest.count({ where }),
    ]);

    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get face verification logs for a mitra with pagination
   */
  async getFaceVerificationLogs(
    mitraId: string,
    page: number = 1,
    limit: number = 20,
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

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }
}

// Singleton
let instance: MitraRepository | null = null;
export function getMitraRepository(): MitraRepository {
  if (!instance) instance = new MitraRepository();
  return instance;
}
