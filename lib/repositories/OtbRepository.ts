import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { IOtbRepository, OtbCreateData, OtbUpdateData, OtbPublic } from './IOtbRepository'

export class OtbRepository implements IOtbRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OtbPublic[]> {
    const items = await this.client.otb.findMany({ orderBy: { createdAt: 'desc' } })
    return items
  }

  async findById(id: string): Promise<OtbPublic | null> {
    const item = await this.client.otb.findUnique({ where: { id } })
    return item
  }

  async create(data: OtbCreateData): Promise<{ id: string }> {
    const item = await this.client.$transaction(async (tx) => {
      const created = await tx.otb.create({
        data: {
          name: data.name,
          location: data.location ?? null,
          coreCount: data.coreCount,
          notes: data.notes ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? 'AKTIF',
        },
        select: { id: true },
      })
      if (data.cores && data.cores.length > 0) {
        await tx.otbCore.createMany({
          data: data.cores.map((c) => ({
            otbId: created.id,
            idx: c.idx,
            slotName: c.slotName,
            tubeColor: c.tubeColor,
            coreColor: c.coreColor,
          })),
        })
      }
      return created
    })
    return item
  }

  async update(id: string, data: OtbUpdateData): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.otb.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.coreCount !== undefined && { coreCount: data.coreCount }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
        },
      })

      if (data.cores) {
        await tx.otbCore.deleteMany({ where: { otbId: id } })
        if (data.cores.length > 0) {
          await tx.otbCore.createMany({
            data: data.cores.map((c) => ({
              otbId: id,
              idx: c.idx,
              slotName: c.slotName,
              tubeColor: c.tubeColor || '',
              coreColor: c.coreColor || '',
            })),
          })
        }
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.otb.delete({ where: { id } })
  }

  async count(): Promise<number> {
    return await this.client.otb.count()
  }
}


