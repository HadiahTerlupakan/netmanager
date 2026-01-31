import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type {
  IJoinboxRepository,
  JoinboxCreateData,
  JoinboxUpdateData,
  JoinboxPublic,
} from './IJoinboxRepository'

export class JoinboxRepository implements IJoinboxRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(siteId?: string): Promise<JoinboxPublic[]> {
    const items = await this.client.joinbox.findMany({
      where: siteId ? { siteId } : {},
      orderBy: { createdAt: 'desc' }
    })
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
          id: randomUUID(),
          updatedAt: new Date(),
          name: data.name,
          images: data.images ?? [],
          location: data.location ?? null,
          notes: data.notes ?? null,
          keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? 'AKTIF',
          siteId: data.siteId ?? null,
        },
        select: { id: true },
      })

      if (data.inputs && data.inputs.length > 0) {
        await tx.joinboxInput.createMany({
          data: data.inputs.map((r) => ({
            id: randomUUID(),
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
            id: randomUUID(),
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
          updatedAt: new Date(),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.images !== undefined && { images: data.images }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.keteranganJumlahKabelFeeder !== undefined && { keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.siteId !== undefined && { siteId: data.siteId }),
        },
      })

      if (data.inputs !== undefined) {
        await tx.joinboxInput.deleteMany({ where: { joinboxId: id } })
        if (data.inputs.length > 0) {
          await tx.joinboxInput.createMany({
            data: data.inputs.map((r) => ({
              id: randomUUID(),
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
              id: randomUUID(),
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


