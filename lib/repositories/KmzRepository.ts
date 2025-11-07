import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { IKmzRepository, KmzFileCreateData, KmzFileUpdateData, KmzFilePublic } from './IKmzRepository'

export class KmzRepository implements IKmzRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<KmzFilePublic[]> {
    const items = await this.client.kmzFile.findMany({ 
      orderBy: { createdAt: 'desc' } 
    })
    return items as unknown as KmzFilePublic[]
  }

  async findById(id: string): Promise<KmzFilePublic | null> {
    const item = await this.client.kmzFile.findUnique({ where: { id } })
    return item as unknown as KmzFilePublic | null
  }

  async findActive(): Promise<KmzFilePublic[]> {
    const items = await this.client.kmzFile.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })
    return items as unknown as KmzFilePublic[]
  }

  async create(data: KmzFileCreateData): Promise<{ id: string }> {
    const created = await this.client.kmzFile.create({
      data: {
        name: data.name,
        filename: data.filename,
        filePath: data.filePath,
        kmlPath: data.kmlPath,
        fileSize: data.fileSize,
        description: data.description ?? null,
        lineColor: data.lineColor ?? '#3388ff',
      },
      select: { id: true },
    })
    return created
  }

  async update(id: string, data: KmzFileUpdateData): Promise<void> {
    await this.client.kmzFile.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.lineColor !== undefined && { lineColor: data.lineColor }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.kmzFile.delete({ where: { id } })
  }

  async count(): Promise<number> {
    return await this.client.kmzFile.count()
  }
}

