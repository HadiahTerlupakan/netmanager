import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterEntity,
  MikroTikRouterStatistics,
  MikroTikRouterUpdateData,
  PaginatedRouterResult,
  PaginationOptions,
  RouterFilters,
} from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import { RadiusRepository } from "./RadiusRepository";
import {
  shouldSyncNasOnUpdate,
  syncNasOnRouterCreate,
  syncNasOnRouterDelete,
  syncNasOnRouterUpdate,
  validateRouterDeletion,
} from "./MikroTikRouterRepository.sync";

export class MikroTikRouterRepository implements IMikroTikRouterRepository {
  private radiusRepo: RadiusRepository;

  constructor(private client: PrismaClient = prisma) {
    this.radiusRepo = new RadiusRepository(client);
  }

  async findAll(tenantId: string): Promise<MikroTikRouterEntity[]> {
    try {
      // Check if mikroTikRouter exists on client
      if (!this.client.mikroTikRouter) {
        throw new Error(
          "Prisma client does not have mikroTikRouter model. Please restart the server after running prisma generate.",
        );
      }
      const routers = await this.client.mikroTikRouter.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
      return routers;
    } catch (error) {
      // Re-throw — caller handles logging to avoid duplicate error output
      throw error;
    }
  }

  async findWithFilters(
    filters: RouterFilters,
    pagination: PaginationOptions,
    tenantId: string,
  ): Promise<PaginatedRouterResult> {
    const { search, siteId } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.MikroTikRouterWhereInput = { tenantId };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { ipAddress: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (siteId) {
      whereClause.siteId = siteId;
    }

    const [routers, total] = await Promise.all([
      this.client.mikroTikRouter.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.client.mikroTikRouter.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      routers,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<MikroTikRouterEntity | null> {
    const router = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
    });
    return router;
  }

  async create(data: MikroTikRouterCreateData): Promise<{ id: string }> {
    // Check if IP already exists for this tenant
    const existingRouter = await this.client.mikroTikRouter.findFirst({
      where: {
        tenantId: data.tenantId || "",
        ipAddress: data.ipAddress,
      },
      select: { id: true, ipAddress: true },
    });

    if (existingRouter) {
      throw new Error(
        `Router dengan IP Address ${data.ipAddress} sudah terdaftar`,
      );
    }

    const router = await this.client.mikroTikRouter.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: data.name,
        ipAddress: data.ipAddress,
        timezone: data.timezone ?? "+07:00 Asia/Jakarta",
        apiPort: data.apiPort ?? 8728,
        apiUsername: data.apiUsername,
        apiPassword: data.apiPassword,
        authPort: data.authPort ?? 7265,
        accountingPort: data.accountingPort ?? 7266,
        secretRadius: data.secretRadius,
        isolirUrl: data.isolirUrl ?? null,
        description: data.description ?? null,
        pingStatus: "offline",
        userOnline: 0,
        siteId: data.siteId ?? null,
        tenantId: data.tenantId,
      },
      select: {
        id: true,
        ipAddress: true,
        secretRadius: true,
        name: true,
        description: true,
        tenantId: true,
      },
    });

    await syncNasOnRouterCreate(this.radiusRepo, router, data.apiPort ?? 8728);

    return { id: router.id };
  }

  async update(
    id: string,
    data: MikroTikRouterUpdateData,
    tenantId: string,
  ): Promise<void> {
    // Fetch existing router first to handle NAS sync
    const existingRouter = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
      select: {
        ipAddress: true,
        secretRadius: true,
        name: true,
        tenantId: true,
      },
    });

    await this.client.mikroTikRouter.updateMany({
      where: { id, tenantId },
      data: {
        updatedAt: new Date(),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.apiPort !== undefined && { apiPort: data.apiPort }),
        ...(data.apiUsername !== undefined && {
          apiUsername: data.apiUsername,
        }),
        ...(data.apiPassword !== undefined && {
          apiPassword: data.apiPassword,
        }),
        ...(data.apiUsernameGenerated !== undefined && {
          apiUsernameGenerated: data.apiUsernameGenerated,
        }),
        ...(data.apiPasswordGenerated !== undefined && {
          apiPasswordGenerated: data.apiPasswordGenerated,
        }),
        ...(data.authPort !== undefined && { authPort: data.authPort }),
        ...(data.accountingPort !== undefined && {
          accountingPort: data.accountingPort,
        }),
        ...(data.secretRadius !== undefined && {
          secretRadius: data.secretRadius,
        }),
        ...(data.isolirUrl !== undefined && { isolirUrl: data.isolirUrl }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.pingStatus !== undefined && { pingStatus: data.pingStatus }),
        ...(data.userOnline !== undefined && { userOnline: data.userOnline }),
        ...(data.lastStatusCheck !== undefined && {
          lastStatusCheck: data.lastStatusCheck,
        }),
        ...(data.siteId !== undefined && { siteId: data.siteId }),
        ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
      },
    });

    if (existingRouter && shouldSyncNasOnUpdate(existingRouter, data)) {
      await syncNasOnRouterUpdate(this.radiusRepo, existingRouter, data);
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    // Fetch existing router first to check relations and get IP for NAS deletion
    const existingRouter = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
      select: {
        ipAddress: true,
        name: true,
        tenantId: true,
        profilePPP: {
          select: {
            id: true,
            name: true,
            hargaPaket: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!existingRouter) {
      throw new Error("Router tidak ditemukan");
    }

    validateRouterDeletion(existingRouter);

    await this.client.mikroTikRouter.deleteMany({
      where: { id, tenantId },
    });

    await syncNasOnRouterDelete(this.radiusRepo, existingRouter, id);
  }

  async count(tenantId: string, siteId?: string): Promise<number> {
    const where: Prisma.MikroTikRouterWhereInput = { tenantId };
    if (siteId) where.siteId = siteId;
    return await this.client.mikroTikRouter.count({ where });
  }

  async getStatistics(
    tenantId: string,
    siteId?: string,
  ): Promise<MikroTikRouterStatistics> {
    const where: Prisma.MikroTikRouterWhereInput = { tenantId };
    if (siteId) where.siteId = siteId;

    const total = await this.client.mikroTikRouter.count({ where });
    const online = await this.client.mikroTikRouter.count({
      where: { ...where, pingStatus: "online" },
    });
    const offline = await this.client.mikroTikRouter.count({
      where: { ...where, pingStatus: "offline" },
    });

    const routers = await this.client.mikroTikRouter.findMany({
      where,
      select: { userOnline: true },
    });
    const totalUserOnline = routers.reduce(
      (sum, router) => sum + router.userOnline,
      0,
    );

    return {
      total,
      online,
      offline,
      totalUserOnline,
    };
  }
}
