import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import type {
  OdpCreateData,
  OdpEntity,
  OdpUpdateData,
} from "../domain/entities/OdpEntity";
import type { IOdpRepository } from "../domain/ports/IOdpRepository";

export class OdpRepository implements IOdpRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(siteId?: string): Promise<OdpEntity[]> {
    const items = await this.client.odp.findMany({
      where: siteId ? { siteId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { odpOutput: true },
        },
        site: {
          select: { name: true },
        },
      },
    });
    return items as unknown as OdpEntity[];
  }

  async findById(id: string): Promise<OdpEntity | null> {
    const item = await this.client.odp.findUnique({ where: { id } });
    return item as unknown as OdpEntity | null;
  }

  async create(data: OdpCreateData): Promise<{ id: string }> {
    const created = await this.client.$transaction(async (tx) => {
      const odp = await tx.odp.create({
        data: {
          id: randomUUID(),
          name: data.name,
          images: data.images ?? [],
          location: data.location ?? null,
          notes: data.notes ?? null,
          keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          status: data.status ?? "AKTIF",
          odcOutputId: data.odcOutputId ?? null,
          siteId: data.siteId ?? null,
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      if (data.outputs && data.outputs.length > 0) {
        await tx.odpOutput.createMany({
          data: data.outputs.map((o) => ({
            id: randomUUID(),
            odpId: odp.id,
            idx: o.idx,
            slotName: o.slotName,
            redaman: o.redaman ?? null,
            tubeColor: o.tubeColor,
            coreColor: o.coreColor,
          })),
        });
      }

      return odp;
    });
    return created;
  }

  async update(id: string, data: OdpUpdateData): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.odp.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.images !== undefined && { images: data.images }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.keteranganJumlahKabelFeeder !== undefined && {
            keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder,
          }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.odcOutputId !== undefined && {
            odcOutputId: data.odcOutputId,
          }),
          ...(data.siteId !== undefined && { siteId: data.siteId }),
          updatedAt: new Date(),
        },
      });

      if (data.outputs !== undefined) {
        await tx.odpOutput.deleteMany({ where: { odpId: id } });
        if (data.outputs.length > 0) {
          await tx.odpOutput.createMany({
            data: data.outputs.map((o) => ({
              id: randomUUID(),
              odpId: id,
              idx: o.idx,
              slotName: o.slotName,
              redaman: o.redaman ?? null,
              tubeColor: o.tubeColor,
              coreColor: o.coreColor,
            })),
          });
        }
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.odp.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return await this.client.odp.count();
  }
}
