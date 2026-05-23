import { prisma } from "@/modules/database";
import type { VlanPurpose } from "@prisma/client";

interface VlanConfig {
  id: string;
  tenantId: string;
  oltId: string;
  ponPort: number | null;
  vlanId: number;
  vlanName: string | null;
  purpose: string;
  createdAt: Date;
}

interface CreateVlanConfigInput {
  tenantId: string;
  oltId: string;
  ponPort?: number;
  vlanId: number;
  vlanName?: string;
  purpose?: string;
}

export class VlanConfigRepository {
  async findByOlt(oltId: string, tenantId: string): Promise<VlanConfig[]> {
    const configs = await prisma.oltVlanConfig.findMany({
      where: { oltId, tenantId },
      orderBy: [{ ponPort: "asc" }, { vlanId: "asc" }],
    });
    return configs as VlanConfig[];
  }

  async findByOltAndPort(
    oltId: string,
    ponPort: number,
  ): Promise<VlanConfig | null> {
    const config = await prisma.oltVlanConfig.findFirst({
      where: { oltId, OR: [{ ponPort }, { ponPort: null }] },
      orderBy: { ponPort: "desc" },
    });
    return config as VlanConfig | null;
  }

  async create(input: CreateVlanConfigInput): Promise<VlanConfig> {
    const config = await prisma.oltVlanConfig.create({
      data: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        ponPort: input.ponPort ?? null,
        vlanId: input.vlanId,
        vlanName: input.vlanName ?? null,
        purpose: (input.purpose ?? "INTERNET") as VlanPurpose,
      },
    });
    return config as VlanConfig;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const result = await prisma.oltVlanConfig.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0) {
      throw new Error("VLAN config tidak ditemukan");
    }
  }
}
