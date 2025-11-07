import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  IJoinboxRepository,
  JoinboxCreateData,
  JoinboxUpdateData,
  JoinboxPublic,
} from './IJoinboxRepository'

export class JoinboxRepository implements IJoinboxRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<JoinboxPublic[]> {
    const items = await this.client.joinbox.findMany({ orderBy: { createdAt: 'desc' } })
    return items as unknown as JoinboxPublic[]
  }

  async findById(id: string): Promise<JoinboxPublic | null> {
    const item = await this.client.joinbox.findUnique({ where: { id } })
    return item as unknown as JoinboxPublic | null
  }

  async create(data: JoinboxCreateData): Promise<{ id: string }> {
    const created = await this.client.$transaction(async (tx) => {
      const jb = await tx.joinbox.create({
        data: {
          name: data.name,
          location: data.location ?? null,
          notes: data.notes ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? 'AKTIF',
        },
        select: { id: true },
      })

      if (data.inputs && data.inputs.length > 0) {
        await tx.joinboxInput.createMany({
          data: data.inputs.map((r) => ({
            joinboxId: jb.id,
            idx: r.idx,
            inputUnit: r.inputUnit,
            portUnit: r.portUnit,
            tubeColor: r.tubeColor,
            coreColor: r.coreColor,
          })),
        })
      }

      if (data.outputs && data.outputs.length > 0) {
        await tx.joinboxOutput.createMany({
          data: data.outputs.map((r) => ({
            joinboxId: jb.id,
            idx: r.idx,
            inputUnit: r.inputUnit,
            portUnit: r.portUnit,
            tubeColor: r.tubeColor,
            coreColor: r.coreColor,
          })),
        })
      }

      return jb
    })
    return created
  }

  async update(id: string, data: JoinboxUpdateData): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.joinbox.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
        },
      })

      if (data.inputs !== undefined) {
        await tx.joinboxInput.deleteMany({ where: { joinboxId: id } })
        if (data.inputs.length > 0) {
          await tx.joinboxInput.createMany({
            data: data.inputs.map((r) => ({
              joinboxId: id,
              idx: r.idx,
              inputUnit: r.inputUnit,
              portUnit: r.portUnit,
              tubeColor: r.tubeColor,
              coreColor: r.coreColor,
            })),
          })
        }
      }

      if (data.outputs !== undefined) {
        await tx.joinboxOutput.deleteMany({ where: { joinboxId: id } })
        if (data.outputs.length > 0) {
          await tx.joinboxOutput.createMany({
            data: data.outputs.map((r) => ({
              joinboxId: id,
              idx: r.idx,
              inputUnit: r.inputUnit,
              portUnit: r.portUnit,
              tubeColor: r.tubeColor,
              coreColor: r.coreColor,
            })),
          })
        }
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.joinboxInput.deleteMany({ where: { joinboxId: id } })
      await tx.joinboxOutput.deleteMany({ where: { joinboxId: id } })
      await tx.joinbox.delete({ where: { id } })
    })
  }

  async count(): Promise<number> {
    return await this.client.joinbox.count()
  }
}


