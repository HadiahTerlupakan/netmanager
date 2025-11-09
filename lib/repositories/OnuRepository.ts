import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { IOnuRepository, OnuCreateData, OnuUpdateData, OnuPublic } from './IOnuRepository'

export class OnuRepository implements IOnuRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OnuPublic[]> {
    const onus = await this.client.onu.findMany({
      orderBy: { lastUpdate: 'desc' },
    })
    return onus
  }

  async findByOltId(oltId: string): Promise<OnuPublic[]> {
    const onus = await this.client.onu.findMany({
      where: { oltId },
      orderBy: { gponOnu: 'asc' },
    })
    return onus
  }

  async findByGponOnu(oltId: string, gponOnu: string): Promise<OnuPublic | null> {
    const onu = await this.client.onu.findUnique({
      where: {
        oltId_gponOnu: {
          oltId,
          gponOnu,
        },
      },
    })
    return onu
  }

  async create(data: OnuCreateData): Promise<{ id: string }> {
    const onu = await this.client.onu.create({
      data: {
        ...data,
        lastUpdate: new Date(),
      },
      select: { id: true },
    })
    return onu
  }

  async upsert(oltId: string, gponOnu: string, data: OnuCreateData): Promise<{ id: string }> {
    const onu = await this.client.onu.upsert({
      where: {
        oltId_gponOnu: {
          oltId,
          gponOnu,
        },
      },
      create: {
        ...data,
        oltId,
        gponOnu,
        lastUpdate: new Date(),
      },
      update: {
        ...data,
        lastUpdate: new Date(),
      },
      select: { id: true },
    })
    return onu
  }

  async update(id: string, data: OnuUpdateData): Promise<void> {
    await this.client.onu.update({
      where: { id },
      data: {
        ...data,
        lastUpdate: data.lastUpdate || new Date(),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.onu.delete({
      where: { id },
    })
  }

  async deleteByOltId(oltId: string): Promise<void> {
    await this.client.onu.deleteMany({
      where: { oltId },
    })
  }

  async count(): Promise<number> {
    return await this.client.onu.count()
  }

  async countByOltId(oltId: string): Promise<number> {
    return await this.client.onu.count({
      where: { oltId },
    })
  }

  async countByStatus(status: string): Promise<number> {
    return await this.client.onu.count({
      where: { status },
    })
  }
}

