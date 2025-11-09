import { PrismaClient } from '@prisma/client'
import { IOnuTypeRepository, OnuTypeCreateData, OnuTypeUpdateData, OnuTypePublic } from './IOnuTypeRepository'
import { prisma } from '@/lib/prisma'

export class OnuTypeRepository implements IOnuTypeRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OnuTypePublic[]> {
    const onuTypes = await this.client.onuType.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return onuTypes
  }

  async findByOltId(oltId: string): Promise<OnuTypePublic[]> {
    const onuTypes = await this.client.onuType.findMany({
      where: { oltId },
      orderBy: { name: 'asc' },
    })
    return onuTypes
  }

  async findById(id: string): Promise<OnuTypePublic | null> {
    const onuType = await this.client.onuType.findUnique({
      where: { id },
    })
    return onuType
  }

  async create(data: OnuTypeCreateData): Promise<{ id: string }> {
    const onuType = await this.client.onuType.create({
      data: {
        oltId: data.oltId,
        name: data.name,
        ethernetPorts: data.ethernetPorts,
        wifi: data.wifi,
        voipPorts: data.voipPorts,
      },
      select: { id: true },
    })
    return onuType
  }

  async update(id: string, data: OnuTypeUpdateData): Promise<void> {
    await this.client.onuType.update({
      where: { id },
      data: {
        name: data.name,
        ethernetPorts: data.ethernetPorts,
        wifi: data.wifi,
        voipPorts: data.voipPorts,
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.onuType.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.onuType.count()
  }
}

