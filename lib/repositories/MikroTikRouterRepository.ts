import { PrismaClient } from '@prisma/client'
import type { IMikroTikRouterRepository, MikroTikRouterCreateData, MikroTikRouterUpdateData, MikroTikRouterPublic, MikroTikRouterStatistics } from './IMikroTikRouterRepository'
import { prisma } from '@/lib/prisma'

export class MikroTikRouterRepository implements IMikroTikRouterRepository {
  constructor(private client: PrismaClient = prisma) {}

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

  async findById(id: string): Promise<MikroTikRouterPublic | null> {
    const router = await this.client.mikroTikRouter.findUnique({
      where: { id },
    })
    return router
  }

  async create(data: MikroTikRouterCreateData): Promise<{ id: string }> {
    const router = await this.client.mikroTikRouter.create({
      data: {
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
      },
      select: { id: true },
    })
    return router
  }

  async update(id: string, data: MikroTikRouterUpdateData): Promise<void> {
    await this.client.mikroTikRouter.update({
      where: { id },
      data: {
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
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.mikroTikRouter.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.mikroTikRouter.count()
  }

  async getStatistics(): Promise<MikroTikRouterStatistics> {
    const total = await this.client.mikroTikRouter.count()
    const online = await this.client.mikroTikRouter.count({
      where: { pingStatus: 'online' }
    })
    const offline = await this.client.mikroTikRouter.count({
      where: { pingStatus: 'offline' }
    })
    
    const routers = await this.client.mikroTikRouter.findMany({
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

