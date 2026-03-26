import { PrismaClient, Prisma } from '@prisma/client'
import type { IMikroTikRouterRepository, MikroTikRouterCreateData, MikroTikRouterUpdateData, MikroTikRouterPublic, MikroTikRouterStatistics } from './IMikroTikRouterRepository'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { RadiusRepository } from './RadiusRepository'

export class MikroTikRouterRepository implements IMikroTikRouterRepository {
  private radiusRepo: RadiusRepository;

  constructor(private client: PrismaClient = prisma) {
    this.radiusRepo = new RadiusRepository(client);
  }

  async findAll(tenantId: string): Promise<MikroTikRouterPublic[]> {
    try {
      // Check if mikroTikRouter exists on client
      if (!this.client.mikroTikRouter) {
        throw new Error('Prisma client does not have mikroTikRouter model. Please restart the server after running prisma generate.')
      }
      const routers = await this.client.mikroTikRouter.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
      return routers
    } catch (error) {
      // Re-throw — caller handles logging to avoid duplicate error output
      throw error
    }
  }

  async findWithFilters(
    filters: import('./IMikroTikRouterRepository').RouterFilters,
    pagination: import('./IMikroTikRouterRepository').PaginationOptions,
    tenantId: string
  ): Promise<import('./IMikroTikRouterRepository').PaginatedRouterResult> {
    const { search, siteId } = filters
    const { page, limit } = pagination
    const skip = (page - 1) * limit

    const whereClause: Prisma.MikroTikRouterWhereInput = { tenantId }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (siteId) {
      whereClause.siteId = siteId
    }

    const [routers, total] = await Promise.all([
      this.client.mikroTikRouter.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.client.mikroTikRouter.count({ where: whereClause }),
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      routers,
      total,
      page,
      limit,
      totalPages,
    }
  }

  async findById(id: string, tenantId: string): Promise<MikroTikRouterPublic | null> {
    const router = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
    })
    return router
  }

  async create(data: MikroTikRouterCreateData): Promise<{ id: string }> {
    // Gunakan upsert agar jika IP sudah ada untuk tenant ini, datanya diperbarui (overwrite)
    const router = await this.client.mikroTikRouter.upsert({
      where: {
        tenantId_ipAddress: {
          tenantId: data.tenantId || '',
          ipAddress: data.ipAddress,
        }
      },
      update: {
        name: data.name,
        updatedAt: new Date(),
        timezone: data.timezone ?? '+07:00 Asia/Jakarta',
        apiPort: data.apiPort ?? 8728,
        apiUsername: data.apiUsername,
        apiPassword: data.apiPassword,
        authPort: data.authPort ?? 7265,
        accountingPort: data.accountingPort ?? 7266,
        secretRadius: data.secretRadius,
        isolirUrl: data.isolirUrl ?? null,
        description: data.description ?? null,
        siteId: data.siteId ?? null,
      },
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: data.name,
        ipAddress: data.ipAddress,
        timezone: data.timezone ?? '+07:00 Asia/Jakarta',
        apiPort: data.apiPort ?? 8728,
        apiUsername: data.apiUsername,
        apiPassword: data.apiPassword,
        authPort: data.authPort ?? 7265,
        accountingPort: data.accountingPort ?? 7266,
        secretRadius: data.secretRadius,
        isolirUrl: data.isolirUrl ?? null,
        description: data.description ?? null,
        pingStatus: 'offline',
        userOnline: 0,
        siteId: data.siteId ?? null,
        tenantId: data.tenantId,
      },
      select: { id: true, ipAddress: true, secretRadius: true, name: true, description: true, tenantId: true },
    })

    // Sync to RADIUS NAS (Repository sudah menggunakan upsert di internalnya)
    try {
      if (router.tenantId) {
        await this.radiusRepo.createNas({
          nasname: router.ipAddress,
          shortname: router.name,
          type: 'other',
          ports: data.apiPort ?? 8728,
          secret: router.secretRadius,
          description: router.description || `Auto-sync: MikroTik ${router.name}`,
          community: 'public',
        }, router.tenantId);
      }
    } catch (error) {
      console.error(`Failed to sync NAS for router ${router.name}:`, error);
    }

    return { id: router.id }
  }

  async update(id: string, data: MikroTikRouterUpdateData, tenantId: string): Promise<void> {
    // Fetch existing router first to handle NAS sync
    const existingRouter = await this.client.mikroTikRouter.findFirst({
      where: { id, tenantId },
      select: { ipAddress: true, secretRadius: true, name: true, tenantId: true }
    });

    await this.client.mikroTikRouter.updateMany({
      where: { id, tenantId },
      data: {
        updatedAt: new Date(),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.apiPort !== undefined && { apiPort: data.apiPort }),
        ...(data.apiUsername !== undefined && { apiUsername: data.apiUsername }),
        ...(data.apiPassword !== undefined && { apiPassword: data.apiPassword }),
        ...(data.authPort !== undefined && { authPort: data.authPort }),
        ...(data.accountingPort !== undefined && { accountingPort: data.accountingPort }),
        ...(data.secretRadius !== undefined && { secretRadius: data.secretRadius }),
        ...(data.isolirUrl !== undefined && { isolirUrl: data.isolirUrl }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.pingStatus !== undefined && { pingStatus: data.pingStatus }),
        ...(data.userOnline !== undefined && { userOnline: data.userOnline }),
        ...(data.lastStatusCheck !== undefined && { lastStatusCheck: data.lastStatusCheck }),
        ...(data.siteId !== undefined && { siteId: data.siteId }),
        ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
      },
    })

    // Sync NAS if critical fields changed
    if (existingRouter) {
      const ipChanged = data.ipAddress && data.ipAddress !== existingRouter.ipAddress;
      const secretChanged = data.secretRadius && data.secretRadius !== existingRouter.secretRadius;
      const nameChanged = data.name && data.name !== existingRouter.name;
      const descChanged = data.description !== undefined;

      if (ipChanged || secretChanged || nameChanged || descChanged) {
        try {
          const targetIp = existingRouter.ipAddress; // Look up by OLD IP
          const existingNas = await this.radiusRepo.getNasByIp(targetIp, existingRouter.tenantId!);

          const newNasData = {
            nasname: data.ipAddress ?? existingRouter.ipAddress,
            secret: data.secretRadius ?? existingRouter.secretRadius,
            shortname: data.name ?? existingRouter.name,
            ...(data.description !== undefined ? { description: data.description ?? '' } : {}),
          };

          if (existingNas && existingNas.id) {
            await this.radiusRepo.updateNas(existingNas.id, newNasData, existingRouter.tenantId!);
          } else {
            // Self-healing: Create if it didn't exist
            await this.radiusRepo.createNas({
              ...newNasData,
              type: 'other',
              ports: data.apiPort ?? 8728,
              community: 'public',
            }, existingRouter.tenantId!);
          }
        } catch (error) {
          console.error(`Failed to sync NAS update for router ${id}:`, error);
        }
      }
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
              select: { id: true }
            }
          }
        },
      }
    });

    if (!existingRouter) {
      throw new Error('Router tidak ditemukan');
    }

    // Check for related ProfilePPP - prevent deletion if has relations
    if (existingRouter.profilePPP && existingRouter.profilePPP.length > 0) {
      const profileNames = existingRouter.profilePPP.map(p => p.name).join(', ');
      const hasActivePackages = existingRouter.profilePPP.some(p => p.hargaPaket.length > 0);
      
      if (hasActivePackages) {
        throw new Error(
          `Router "${existingRouter.name}" tidak dapat dihapus karena masih memiliki ${existingRouter.profilePPP.length} Profile PPP yang terhubung (${profileNames}) dan beberapa memiliki paket harga aktif. Hapus atau pindahkan Profile PPP terlebih dahulu.`
        );
      } else {
        throw new Error(
          `Router "${existingRouter.name}" tidak dapat dihapus karena masih memiliki ${existingRouter.profilePPP.length} Profile PPP yang terhubung (${profileNames}). Hapus atau pindahkan Profile PPP terlebih dahulu.`
        );
      }
    }

    await this.client.mikroTikRouter.deleteMany({
      where: { id, tenantId },
    })

    // Delete NAS
    try {
      const nas = await this.radiusRepo.getNasByIp(existingRouter.ipAddress, existingRouter.tenantId!);
      if (nas && nas.id) {
        await this.radiusRepo.deleteNas(nas.id, existingRouter.tenantId!);
      }
    } catch (error) {
      console.error(`Failed to delete NAS for router ${id}:`, error);
    }
  }

  async count(tenantId: string, siteId?: string): Promise<number> {
    const where: Prisma.MikroTikRouterWhereInput = { tenantId }
    if (siteId) where.siteId = siteId
    return await this.client.mikroTikRouter.count({ where })
  }

  async getStatistics(tenantId: string, siteId?: string): Promise<MikroTikRouterStatistics> {
    const where: Prisma.MikroTikRouterWhereInput = { tenantId }
    if (siteId) where.siteId = siteId

    const total = await this.client.mikroTikRouter.count({ where })
    const online = await this.client.mikroTikRouter.count({
      where: { ...where, pingStatus: 'online' }
    })
    const offline = await this.client.mikroTikRouter.count({
      where: { ...where, pingStatus: 'offline' }
    })

    const routers = await this.client.mikroTikRouter.findMany({
      where,
      select: { userOnline: true }
    })
    const totalUserOnline = routers.reduce((sum, router) => sum + router.userOnline, 0)

    return {
      total,
      online,
      offline,
      totalUserOnline
    }
  }
}

