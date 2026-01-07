import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type { IPoleRepository, PoleCreateData, PoleUpdateData, PolePublic } from './IPoleRepository'

export class PoleRepository implements IPoleRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(siteId?: string): Promise<PolePublic[]> {
    const items = await this.client.pole.findMany({
        where: siteId ? { siteId } : {},
        orderBy: { createdAt: 'desc' }
    })
    return items as unknown as PolePublic[]
  }

  async findById(id: string): Promise<PolePublic | null> {
    const item = await this.client.pole.findUnique({ where: { id } })
    return item as unknown as PolePublic | null
  }

  async create(data: PoleCreateData): Promise<{ id: string }> {
    const created = await this.client.pole.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: data.name,
        location: data.location ?? null,
        notes: data.notes ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        status: data.status ?? 'AKTIF',
        cableSlack: data.cableSlack ?? false,
        siteId: data.siteId,
      },
      select: { id: true },
    })
    return created
  }

  async update(id: string, data: PoleUpdateData): Promise<void> {
    await this.client.pole.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.cableSlack !== undefined && { cableSlack: data.cableSlack }),
        ...(data.siteId !== undefined && { siteId: data.siteId }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.pole.delete({ where: { id } })
  }

  async count(): Promise<number> {
    return await this.client.pole.count()
  }
}


