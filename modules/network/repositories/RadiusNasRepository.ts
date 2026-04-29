import { prismaRadius } from "@/lib/prisma-radius";
import type { NasEntity } from "../domain/entities/RadiusEntity";
import { toNasEntity } from "./radiusRepository.mappers";

export class RadiusNasRepository {
  constructor(
    private readonly radiusClient: typeof prismaRadius = prismaRadius,
  ) {}

  async createNas(nas: NasEntity, tenantId: string): Promise<NasEntity> {
    const created = await this.radiusClient.nas.upsert({
      where: {
        nasname_tenantId: {
          nasname: nas.nasname,
          tenantId,
        },
      },
      update: {
        shortname: nas.shortname ?? null,
        type: nas.type || "other",
        ports: nas.ports ?? null,
        secret: nas.secret,
        community: nas.community ?? null,
        description: nas.description ?? null,
      },
      create: {
        nasname: nas.nasname,
        shortname: nas.shortname ?? null,
        type: nas.type || "other",
        ports: nas.ports ?? null,
        secret: nas.secret,
        community: nas.community ?? null,
        description: nas.description ?? null,
        tenantId,
      },
    });

    return toNasEntity(created);
  }

  async updateNas(
    id: number,
    nas: Partial<NasEntity>,
    tenantId: string,
  ): Promise<NasEntity> {
    const updated = await this.radiusClient.nas.update({
      where: { id, tenantId },
      data: {
        ...(nas.nasname !== undefined ? { nasname: nas.nasname } : {}),
        ...(nas.shortname !== undefined ? { shortname: nas.shortname } : {}),
        ...(nas.type !== undefined ? { type: nas.type } : {}),
        ...(nas.ports !== undefined ? { ports: nas.ports } : {}),
        ...(nas.secret !== undefined ? { secret: nas.secret } : {}),
        ...(nas.community !== undefined ? { community: nas.community } : {}),
        ...(nas.description !== undefined
          ? { description: nas.description }
          : {}),
      },
    });

    return toNasEntity(updated);
  }

  async deleteNas(id: number, tenantId: string): Promise<void> {
    await this.radiusClient.nas.delete({
      where: { id, tenantId },
    });
  }

  async getNasById(id: number, tenantId: string): Promise<NasEntity | null> {
    const nas = await this.radiusClient.nas.findFirst({
      where: { id, tenantId },
    });

    if (!nas) return null;

    return toNasEntity(nas);
  }

  async getAllNas(tenantId: string): Promise<NasEntity[]> {
    const nasList = await this.radiusClient.nas.findMany({
      where: { tenantId },
      orderBy: { nasname: "asc" },
    });

    return nasList.map(toNasEntity);
  }

  async getNasByIp(ip: string, tenantId: string): Promise<NasEntity | null> {
    const nas = await this.radiusClient.nas.findFirst({
      where: { nasname: ip, tenantId },
    });

    if (!nas) return null;

    return toNasEntity(nas);
  }
}
