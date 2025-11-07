import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { IOdpRepository, OdpCreateData, OdpUpdateData, OdpPublic } from './IOdpRepository'

export class OdpRepository implements IOdpRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OdpPublic[]> {
    const items = await this.client.odp.findMany({ orderBy: { createdAt: 'desc' } })
    return items as unknown as OdpPublic[]
  }

  async findById(id: string): Promise<OdpPublic | null> {
    const item = await this.client.odp.findUnique({ where: { id } })
    return item as unknown as OdpPublic | null
  }

  async create(data: OdpCreateData): Promise<{ id: string }> {
    const created = await this.client.$transaction(async (tx) => {
      const odp = await tx.odp.create({
        data: {
          name: data.name,
          location: data.location ?? null,
          notes: data.notes ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? 'AKTIF',
          odcOutputId: data.odcOutputId,
        },
        select: { id: true },
      })

      if (data.outputs && data.outputs.length > 0) {
        await tx.odpOutput.createMany({
          data: data.outputs.map((o) => ({
            odpId: odp.id,
            idx: o.idx,
            slotName: o.slotName,
            redaman: o.redaman ?? null,
            tubeColor: o.tubeColor,
            coreColor: o.coreColor,
          })),
        })
      }

      return odp
    })
    return created
  }

  async update(id: string, data: OdpUpdateData): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.odp.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.odcOutputId !== undefined && { odcOutputId: data.odcOutputId }),
        },
      })

      if (data.outputs !== undefined) {
        await tx.odpOutput.deleteMany({ where: { odpId: id } })
        if (data.outputs.length > 0) {
          await tx.odpOutput.createMany({
            data: data.outputs.map((o) => ({
              odpId: id,
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
    await this.client.odp.delete({ where: { id } })
  }

  async count(): Promise<number> {
    return await this.client.odp.count()
  }
}


