import { PrismaClient } from '@prisma/client'
import type { IMikroTikRouterRepository, MikroTikRouterCreateData, MikroTikRouterUpdateData, MikroTikRouterPublic, MikroTikRouterStatistics } from './IMikroTikRouterRepository'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { RadiusRepository } from './RadiusRepository'

export class MikroTikRouterRepository implements IMikroTikRouterRepository {
  private radiusRepo: RadiusRepository;

  constructor(private client: PrismaClient = prisma) {
    this.radiusRepo = new RadiusRepository(client);
  }

  async findAll(): Promise<MikroTikRouterPublic[]> {
    try {
      // Check if mikroTikRouter exists on client
      if (!this.client.mikroTikRouter) {
        throw new Error('Prisma client does not have mikroTikRouter model. Please restart the server after running prisma generate.')
      }
      const routers = await this.client.mikroTikRouter.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return routers
    } catch (error: any) {
      console.error('Error in MikroTikRouterRepository.findAll:', error)
      throw error
    }
  }

  async findWithFilters(
    filters: import('./IMikroTikRouterRepository').RouterFilters,
    pagination: import('./IMikroTikRouterRepository').PaginationOptions
  ): Promise<import('./IMikroTikRouterRepository').PaginatedRouterResult> {
    const { search, siteId } = filters
    const { page, limit } = pagination
    const skip = (page - 1) * limit

    const whereClause: any = {} // Using any to avoid complex Prisma types import for now, or use Prisma.MikroTikRouterWhereInput

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

  async findById(id: string): Promise<MikroTikRouterPublic | null> {
    const router = await this.client.mikroTikRouter.findUnique({
      where: { id },
    })
    return router
  }

  async create(data: MikroTikRouterCreateData): Promise<{ id: string }> {
    const router = await this.client.mikroTikRouter.create({
      data: {
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
        siteId: data.siteId ?? undefined,
      },
      select: { id: true, ipAddress: true, secretRadius: true, name: true, description: true },
    })

    // Sync to RADIUS NAS
    try {
      await this.radiusRepo.createNas({
        nasname: router.ipAddress,
        shortname: router.name,
        type: 'other',
        ports: data.apiPort ?? 8728, // Using API port as reference, though NAS ports are virtual
        secret: router.secretRadius,
        description: router.description || `Auto-sync: MikroTik ${router.name}`,
        community: 'public', // Default community
      });
    } catch (error) {
      console.error(`Failed to sync NAS for router ${router.name}:`, error);
      // We don't throw here to ensure Router creation isn't blocked by RADIUS sync failure,
      // but we log it. In strict mode, we might want to throw.
    }

    return { id: router.id }
  }

  async update(id: string, data: MikroTikRouterUpdateData): Promise<void> {
    // Fetch existing router first to handle NAS sync
    const existingRouter = await this.client.mikroTikRouter.findUnique({
      where: { id },
      select: { ipAddress: true, secretRadius: true, name: true }
    });

    const router = await this.client.mikroTikRouter.update({
      where: { id },
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
          const existingNas = await this.radiusRepo.getNasByIp(targetIp);

          const newNasData = {
            nasname: data.ipAddress ?? existingRouter.ipAddress,
            secret: data.secretRadius ?? existingRouter.secretRadius,
            shortname: data.name ?? existingRouter.name,
            description: data.description ?? undefined, // Only update if provided
          };

          if (existingNas && existingNas.id) {
            await this.radiusRepo.updateNas(existingNas.id, newNasData);
          } else {
            // Self-healing: Create if it didn't exist
            await this.radiusRepo.createNas({
              ...newNasData,
              type: 'other',
              ports: data.apiPort ?? 8728,
              community: 'public',
            });
          }
        } catch (error) {
          console.error(`Failed to sync NAS update for router ${id}:`, error);
        }
      }
    }
  }

  async delete(id: string): Promise<void> {
    // Fetch existing router first to check relations and get IP for NAS deletion
    const existingRouter = await this.client.mikroTikRouter.findUnique({
      where: { id },
      select: { 
        ipAddress: true,
        name: true,
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

    await this.client.mikroTikRouter.delete({
      where: { id },
    })

    // Delete NAS
    try {
      const nas = await this.radiusRepo.getNasByIp(existingRouter.ipAddress);
      if (nas && nas.id) {
        await this.radiusRepo.deleteNas(nas.id);
      }
    } catch (error) {
      console.error(`Failed to delete NAS for router ${id}:`, error);
    }
  }

  async count(siteId?: string): Promise<number> {
    const where: any = {}
    if (siteId) where.siteId = siteId
    return await this.client.mikroTikRouter.count({ where })
  }

  async getStatistics(siteId?: string): Promise<MikroTikRouterStatistics> {
    const where: any = {}
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

