import { prismaMitra } from "@/lib/prisma-mitra";
import type {
  IMitraRepository,
  CreateMitraRecord,
  SaveFaceVerificationRecord,
  UpdateMitraRecord,
} from "../domain/ports/IMitraRepository";
import type { MitraFilters } from "../dto/MitraDTO";
import {
  toFaceVerificationLogEntity,
  toMitraEntity,
  toMitraPushTokenEntity,
  toMitraSummaryEntity,
} from "../mappers/MitraDomainMapper";
import {
  buildCreateMitraData,
  buildMitraWhere,
  buildUpdateMitraData,
  ensureWalletExistsTx,
  getMitraIdCardSelect,
  getMitraListSelect,
} from "./MitraRepository.helpers";
import {
  findSiteNameById,
  getMitraStatsData,
} from "./MitraRepository.stats.helpers";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

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
      select: getMitraIdCardSelect(),
    });

    if (!mitra) {
      return null;
    }

    const site = await findSiteNameById(mitra.siteId);
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
    const where = buildMitraWhere(filters);
    const [mitras, total] = await Promise.all([
      prismaMitra.mitra.findMany({
        where,
        select: getMitraListSelect(),
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
    return getMitraStatsData(tenantId);
  }

  /** Membuat data mitra baru dan wallet awalnya. */
  async createMitra(record: CreateMitraRecord) {
    await prismaMitra.$transaction(async (tx) => {
      await tx.mitra.create({
        data: buildCreateMitraData(
          record.id,
          record.passwordHash,
          record.payload,
        ),
      });
      await ensureWalletExistsTx(tx, record.id);
    });
  }

  /** Memperbarui data mitra dan memastikan wallet tetap tersedia. */
  async updateMitra(record: UpdateMitraRecord) {
    await prismaMitra.$transaction(async (tx) => {
      await tx.mitra.update({
        where: { id: record.id },
        data: buildUpdateMitraData(record.payload, record.passwordHash),
      });
      await ensureWalletExistsTx(tx, record.id);
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
}

let instance: IMitraRepository | null = null;

export function getMitraRepository(): IMitraRepository {
  if (!instance) {
    instance = new MitraRepository();
  }

  return instance;
}
