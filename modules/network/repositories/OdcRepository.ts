import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type { IOdcRepository, OdcCreateData, OdcUpdateData, OdcPublic } from './IOdcRepository'

export class OdcRepository implements IOdcRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(siteId?: string): Promise<OdcPublic[]> {
    const items = await this.client.odc.findMany({
        where: siteId ? { siteId } : {},
        orderBy: { createdAt: 'desc' }
    })
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
          id: randomUUID(),
          name: data.name,
          images: data.images ?? [],
          location: data.location ?? null,
          notes: data.notes ?? null,
          keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? 'AKTIF',
          otbCoreId: data.otbCoreId ?? null,
          siteId: data.siteId ?? null,
          updatedAt: new Date(),
        },
        select: { id: true },
      })

      if (data.outputs && data.outputs.length > 0) {
        await tx.odcOutput.createMany({
          data: data.outputs.map((o) => ({
            id: randomUUID(),
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
          ...(data.images !== undefined && { images: data.images }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.keteranganJumlahKabelFeeder !== undefined && { keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.otbCoreId !== undefined && { otbCoreId: data.otbCoreId }),
          ...(data.siteId !== undefined && { siteId: data.siteId }),
          updatedAt: new Date(),
        },
      })

      if (data.outputs !== undefined) {
        // Get existing outputs with ODP relation check
        const existingOutputs = await tx.odcOutput.findMany({
          where: { odcId: id },
          include: { odp: true },
        })

        // Create a map of idx to existing output
        const existingByIdx = new Map(existingOutputs.map((o) => [o.idx, o]))
        const newIndices = new Set(data.outputs.map((o) => o.idx))

        // Process each output in the new data
        for (const output of data.outputs) {
          const existing = existingByIdx.get(output.idx)
          if (existing) {
            // Update existing output (can update even if used by ODP, just not delete)
            await tx.odcOutput.update({
              where: { id: existing.id },
              data: {
                slotName: output.slotName,
                redaman: output.redaman ?? null,
                tubeColor: output.tubeColor,
                coreColor: output.coreColor,
              },
            })
          } else {
            // Create new output
            await tx.odcOutput.create({
              data: {
                id: randomUUID(),
                odcId: id,
                idx: output.idx,
                slotName: output.slotName,
                redaman: output.redaman ?? null,
                tubeColor: output.tubeColor,
                coreColor: output.coreColor,
              },
            })
          }
        }

        // Delete outputs that are no longer in the new list (only if not used by ODP)
        const toDelete = existingOutputs.filter(
          (o) => !newIndices.has(o.idx) && o.odp === null
        )
        if (toDelete.length > 0) {
          await tx.odcOutput.deleteMany({
            where: {
              id: { in: toDelete.map((o) => o.id) },
            },
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


