import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import type {
  CreateOutletData,
  CreateResellerData,
  IResellerRepository,
  UpdateOutletData,
  UpdateResellerData,
  UpsertPackagePriceData,
} from "../domain/ports/IResellerRepository";
import type {
  ResellerEntity,
  ResellerOutletEntity,
  ResellerPackagePriceEntity,
  ResellerStatusValue,
} from "../domain/entities/ResellerEntity";
import type { ResellerStatusAuditData } from "../domain/ports/IResellerRepository";
import { ResellerNotFoundError } from "../errors/reseller-errors";

const ACTIVE_STATUS = "ACTIVE";
const INACTIVE_STATUS = "INACTIVE";
const SOFT_DELETE_STATUS_REASON = "Reseller dihapus";
const OUTLET_NOT_FOUND_MESSAGE = "Outlet reseller tidak ditemukan";

type ResellerDbClient = Pick<PrismaClient, "reseller">;

function findActiveReseller(
  client: ResellerDbClient,
  tenantId: string | null,
  id: string,
): Promise<ResellerEntity | null> {
  return client.reseller.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
}

/**
 * Baca reseller aktif dengan row lock (SELECT ... FOR UPDATE) di dalam
 * transaksi. Perubahan status yang berlomba antre di sini, jadi status lama
 * yang dicatat di riwayat adalah status sesudah perubahan sebelumnya commit.
 */
async function findActiveResellerForUpdate(
  tx: Prisma.TransactionClient,
  tenantId: string | null,
  id: string,
): Promise<ResellerEntity | null> {
  await tx.$queryRaw`SELECT "id" FROM "Reseller" WHERE "id" = ${id} FOR UPDATE`;
  return findActiveReseller(tx, tenantId, id);
}

/**
 * Status yang diminta sudah berlaku (perubahan yang sama baru saja commit):
 * jangan geser waktu dan pelaku perubahan status, karena kelayakan komisi
 * dinilai dari `statusChangedAt`.
 */
function withoutNoopStatusChange(
  data: UpdateResellerData,
  currentStatus: ResellerStatusValue,
): UpdateResellerData {
  if (data.status === undefined || data.status !== currentStatus) return data;
  const {
    statusChangedAt: _staleChangedAt,
    statusChangedById: _staleChangedById,
    ...rest
  } = data;
  return rest;
}

/**
 * Tulis satu baris riwayat status. Dipanggil hanya di dalam transaksi
 * perubahan status agar riwayat dan status selalu konsisten.
 */
async function recordStatusChange(
  tx: Prisma.TransactionClient,
  reseller: Pick<ResellerEntity, "id" | "tenantId" | "status">,
  fromStatus: ResellerStatusValue | null,
  audit: ResellerStatusAuditData,
): Promise<void> {
  await tx.resellerStatusHistory.create({
    data: {
      id: randomUUID(),
      tenantId: reseller.tenantId,
      resellerId: reseller.id,
      fromStatus,
      toStatus: reseller.status,
      reason: audit.statusReason ?? null,
      changedById: audit.statusChangedById ?? null,
      changedAt: audit.statusChangedAt ?? new Date(),
    },
  });
}

export class ResellerRepository implements IResellerRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Find reseller by code within tenant scope, including soft-deleted rows,
   * because the unique index `[tenantId, code]` covers them as well.
   */
  async findByCode(
    tenantId: string | null,
    code: string,
  ): Promise<ResellerEntity | null> {
    const reseller = await this.db.reseller.findFirst({
      where: { tenantId, code },
    });
    return reseller;
  }

  /** Find reseller by id within tenant scope. */
  async findById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerEntity | null> {
    return findActiveReseller(this.db, tenantId, id);
  }

  /** List resellers within tenant scope. */
  async findAll(params: {
    readonly tenantId: string | null;
    readonly search?: string;
    readonly status?: ResellerStatusValue;
    readonly skip?: number;
    readonly take?: number;
  }): Promise<{
    readonly items: readonly ResellerEntity[];
    readonly total: number;
  }> {
    const keyword = params.search?.trim();
    const where: Prisma.ResellerWhereInput = {
      tenantId: params.tenantId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: "insensitive" } },
              { code: { contains: keyword, mode: "insensitive" } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.reseller.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      this.db.reseller.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Create reseller. Status awal selain ACTIVE dicatat ke riwayat status
   * (dari `null`) dalam transaksi yang sama.
   */
  async create(data: CreateResellerData): Promise<ResellerEntity> {
    return this.db.$transaction(async (tx) => {
      const reseller = await tx.reseller.create({
        data: {
          id: randomUUID(),
          tenantId: data.tenantId,
          code: data.code,
          name: data.name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          address: data.address ?? null,
          notes: data.notes ?? null,
          legalName: data.legalName ?? null,
          nib: data.nib ?? null,
          kbliCode: data.kbliCode ?? null,
          standardCertificateNumber: data.standardCertificateNumber ?? null,
          brandName: data.brandName ?? null,
          licenseVerifiedAt: data.licenseVerifiedAt ?? null,
          licenseVerifiedById: data.licenseVerifiedById ?? null,
          statusReason: data.statusReason ?? null,
          statusChangedAt: data.statusChangedAt ?? null,
          statusChangedById: data.statusChangedById ?? null,
          ...(data.status ? { status: data.status } : {}),
        },
      });
      if (reseller.status !== ACTIVE_STATUS) {
        await recordStatusChange(tx, reseller, null, data);
      }
      return reseller;
    });
  }

  /**
   * Update reseller. Bila status berubah, riwayatnya dicatat dalam transaksi
   * yang sama sehingga status dan jejaknya tidak pernah berselisih. Baris
   * reseller dikunci lebih dulu agar status lama di riwayat tidak basi.
   */
  async update(
    tenantId: string | null,
    id: string,
    data: UpdateResellerData,
  ): Promise<ResellerEntity> {
    return this.db.$transaction(async (tx) => {
      const existing = await findActiveResellerForUpdate(tx, tenantId, id);
      if (!existing) {
        throw new ResellerNotFoundError();
      }
      const updated = await tx.reseller.update({
        where: { id },
        data: withoutNoopStatusChange(data, existing.status),
      });
      if (updated.status !== existing.status) {
        await recordStatusChange(tx, updated, existing.status, data);
      }
      return updated;
    });
  }

  /**
   * Soft delete reseller. Status menjadi INACTIVE; waktu perubahannya dicatat
   * agar komisi pembayaran sebelum penghapusan tetap terakru, dan riwayat
   * status ditulis dalam transaksi yang sama.
   */
  async softDelete(
    tenantId: string | null,
    id: string,
    actorId: string | null = null,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const reseller = await findActiveResellerForUpdate(tx, tenantId, id);
      if (!reseller) {
        throw new ResellerNotFoundError();
      }
      const isStatusChanged = reseller.status !== INACTIVE_STATUS;
      const now = new Date();
      const deleted = await tx.reseller.update({
        where: { id },
        data: {
          deletedAt: now,
          status: INACTIVE_STATUS,
          ...(isStatusChanged ? { statusChangedAt: now } : {}),
        },
      });
      if (isStatusChanged) {
        await recordStatusChange(tx, deleted, reseller.status, {
          statusReason: SOFT_DELETE_STATUS_REASON,
          statusChangedAt: now,
          statusChangedById: actorId,
        });
      }
    });
  }

  /** Find outlet by id within tenant scope. */
  async findOutletById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerOutletEntity | null> {
    const outlet = await this.db.resellerOutlet.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return outlet;
  }

  /**
   * Find outlet by code under reseller, including soft-deleted rows, because
   * the unique index `[tenantId, resellerId, code]` covers them as well.
   */
  async findOutletByCode(
    tenantId: string | null,
    resellerId: string,
    code: string,
  ): Promise<ResellerOutletEntity | null> {
    const outlet = await this.db.resellerOutlet.findFirst({
      where: { tenantId, resellerId, code },
    });
    return outlet;
  }

  /** List outlets by reseller id. */
  async findOutletsByResellerId(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerOutletEntity[]> {
    return this.db.resellerOutlet.findMany({
      where: { tenantId, resellerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Create outlet. */
  async createOutlet(data: CreateOutletData): Promise<ResellerOutletEntity> {
    return this.db.resellerOutlet.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        resellerId: data.resellerId,
        code: data.code,
        name: data.name,
        phone: data.phone ?? null,
        address: data.address ?? null,
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  /** Update outlet. */
  async updateOutlet(
    tenantId: string | null,
    id: string,
    data: UpdateOutletData,
  ): Promise<ResellerOutletEntity> {
    const outlet = await this.findOutletById(tenantId, id);
    if (!outlet) {
      throw new ResellerNotFoundError(OUTLET_NOT_FOUND_MESSAGE);
    }
    return this.db.resellerOutlet.update({ where: { id }, data });
  }

  /** Soft delete outlet. */
  async softDeleteOutlet(tenantId: string | null, id: string): Promise<void> {
    const outlet = await this.findOutletById(tenantId, id);
    if (!outlet) {
      throw new ResellerNotFoundError(OUTLET_NOT_FOUND_MESSAGE);
    }
    await this.db.resellerOutlet.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  }

  /**
   * Find active reseller package price at a point in time.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  async findActivePackagePrice(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly hargaPaketId: string;
    readonly at: Date;
  }): Promise<ResellerPackagePriceEntity | null> {
    return this.db.resellerPackagePrice.findFirst({
      where: {
        tenantId: params.tenantId,
        resellerId: params.resellerId,
        hargaPaketId: params.hargaPaketId,
        status: ACTIVE_STATUS,
        deletedAt: null,
        startsAt: { lte: params.at },
        OR: [{ endsAt: null }, { endsAt: { gte: params.at } }],
      },
      orderBy: { startsAt: "desc" },
    });
  }

  /** Find base package price by package id. */
  async findBasePackagePrice(
    tenantId: string | null,
    hargaPaketId: string,
  ): Promise<number | null> {
    const packagePrice = await this.db.hargaPaket.findFirst({
      where: { id: hargaPaketId, tenantId },
      select: { harga: true },
    });
    return packagePrice?.harga ?? null;
  }

  /**
   * List package prices for reseller.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  async findPackagePricesByResellerId(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerPackagePriceEntity[]> {
    return this.db.resellerPackagePrice.findMany({
      where: { tenantId, resellerId, deletedAt: null },
      orderBy: { startsAt: "desc" },
    });
  }

  /**
   * Create reseller package override.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  async upsertPackagePrice(
    data: UpsertPackagePriceData,
  ): Promise<ResellerPackagePriceEntity> {
    return this.db.resellerPackagePrice.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        resellerId: data.resellerId,
        hargaPaketId: data.hargaPaketId,
        price: data.price,
        startsAt: data.startsAt ?? new Date(),
        endsAt: data.endsAt ?? null,
      },
    });
  }
}
