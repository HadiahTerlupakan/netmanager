import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import type { ISpeedProfileRepository, SpeedProfileCreateData, SpeedProfileUpdateData, SpeedProfilePublic } from './ISpeedProfileRepository'
import { prisma } from '@/lib/prisma'

export class SpeedProfileRepository implements ISpeedProfileRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<SpeedProfilePublic[]> {
    const speedProfiles = await this.client.speedProfile.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return speedProfiles
  }

  async findByOltId(oltId: string): Promise<SpeedProfilePublic[]> {
    const speedProfiles = await this.client.speedProfile.findMany({
      where: { oltId },
      orderBy: { name: 'asc' },
    })
    return speedProfiles
  }

  async findById(id: string): Promise<SpeedProfilePublic | null> {
    const speedProfile = await this.client.speedProfile.findUnique({
      where: { id },
    })
    return speedProfile
  }

  async create(data: SpeedProfileCreateData): Promise<{ id: string }> {
    const speedProfile = await this.client.speedProfile.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        oltId: data.oltId,
        profileType: data.profileType,
        name: data.name,
        type: data.type,
        bandwidthSir: data.bandwidthSir,
        burstPir: data.burstPir,
        fixed: data.fixed ?? null,
        assured: data.assured ?? null,
        maximum: data.maximum ?? null,
      },
      select: { id: true },
    })
    return speedProfile
  }

    async update(id: string, data: SpeedProfileUpdateData): Promise<void> {
    await this.client.speedProfile.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(data.profileType !== undefined ? { profileType: data.profileType } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.bandwidthSir !== undefined ? { bandwidthSir: data.bandwidthSir } : {}),
        ...(data.burstPir !== undefined ? { burstPir: data.burstPir } : {}),
        ...(data.fixed !== undefined ? { fixed: data.fixed } : {}),
        ...(data.assured !== undefined ? { assured: data.assured } : {}),
        ...(data.maximum !== undefined ? { maximum: data.maximum } : {}),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.speedProfile.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.speedProfile.count()
  }
}

