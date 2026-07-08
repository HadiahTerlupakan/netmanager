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
} from "../domain/entities/ResellerEntity";

const ACTIVE_STATUS = "ACTIVE";

export class ResellerRepository implements IResellerRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Find reseller by code within tenant scope. */
  async findByCode(
    tenantId: string | null,
    code: string,
  ): Promise<ResellerEntity | null> {
    const reseller = await this.db.reseller.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    return reseller;
  }

  /** Find reseller by id within tenant scope. */
  async findById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerEntity | null> {
    const reseller = await this.db.reseller.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return reseller;
  }

  /** List resellers within tenant scope. */
  async findAll(params: {
    readonly tenantId: string | null;
    readonly skip?: number;
    readonly take?: number;
  }): Promise<{
    readonly items: readonly ResellerEntity[];
    readonly total: number;
  }> {
    const where: Prisma.ResellerWhereInput = {
      tenantId: params.tenantId,
      deletedAt: null,
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

  /** Create reseller. */
  async create(data: CreateResellerData): Promise<ResellerEntity> {
    return this.db.reseller.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  /** Update reseller. */
  async update(
    tenantId: string | null,
    id: string,
    data: UpdateResellerData,
  ): Promise<ResellerEntity> {
    const reseller = await this.findById(tenantId, id);
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
    return this.db.reseller.update({
      where: { id },
      data,
    });
  }

  /** Soft delete reseller. */
  async softDelete(tenantId: string | null, id: string): Promise<void> {
    const reseller = await this.findById(tenantId, id);
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
    await this.db.reseller.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
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

  /** Find outlet by code under reseller. */
  async findOutletByCode(
    tenantId: string | null,
    resellerId: string,
    code: string,
  ): Promise<ResellerOutletEntity | null> {
    const outlet = await this.db.resellerOutlet.findFirst({
      where: { tenantId, resellerId, code, deletedAt: null },
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
      throw new Error("Outlet tidak ditemukan");
    }
    return this.db.resellerOutlet.update({ where: { id }, data });
  }

  /** Soft delete outlet. */
  async softDeleteOutlet(tenantId: string | null, id: string): Promise<void> {
    const outlet = await this.findOutletById(tenantId, id);
    if (!outlet) {
      throw new Error("Outlet tidak ditemukan");
    }
    await this.db.resellerOutlet.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  }

  /** Find active reseller package price at a point in time. */
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

  /** List package prices for reseller. */
  async findPackagePricesByResellerId(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerPackagePriceEntity[]> {
    return this.db.resellerPackagePrice.findMany({
      where: { tenantId, resellerId, deletedAt: null },
      orderBy: { startsAt: "desc" },
    });
  }

  /** Create reseller package override. */
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
