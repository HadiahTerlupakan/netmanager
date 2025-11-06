import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { IOdcRepository, OdcCreateData, OdcUpdateData, OdcPublic } from './IOdcRepository'

export class OdcRepository implements IOdcRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OdcPublic[]> {
    const items = await this.client.odc.findMany({ orderBy: { createdAt: 'desc' } })
    return items as unknown as OdcPublic[]
  }

  async findById(id: string): Promise<OdcPublic | null> {
    const item = await this.client.odc.findUnique({ where: { id } })
    return item as unknown as OdcPublic | null
  }

  async create(data: OdcCreateData): Promise<{ id: string }> {
    const created = await this.client.$transaction(async (tx) => {
      const odc = await tx.odc.create({
        data: {
          name: data.name,
          location: data.location ?? null,
          notes: data.notes ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          otbCoreId: data.otbCoreId,
        },
        select: { id: true },
      })

      if (data.outputs && data.outputs.length > 0) {
        await tx.odcOutput.createMany({
          data: data.outputs.map((o) => ({
            odcId: odc.id,
            idx: o.idx,
            slotName: o.slotName,
            redaman: o.redaman ?? null,
            tubeColor: o.tubeColor,
            coreColor: o.coreColor,
          })),
        })
      }

      return odc
    })
    return created
  }

  async update(id: string, data: OdcUpdateData): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.odc.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.otbCoreId !== undefined && { otbCoreId: data.otbCoreId }),
        },
      })

      if (data.outputs !== undefined) {
        await tx.odcOutput.deleteMany({ where: { odcId: id } })
        if (data.outputs.length > 0) {
          await tx.odcOutput.createMany({
            data: data.outputs.map((o) => ({
              odcId: id,
              idx: o.idx,
              slotName: o.slotName,
              redaman: o.redaman ?? null,
              tubeColor: o.tubeColor,
              coreColor: o.coreColor,
            })),
          })
        }
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.odc.delete({ where: { id } })
  }

  async count(): Promise<number> {
    return await this.client.odc.count()
  }
}


