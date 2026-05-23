import { prisma } from "@/modules/database";

interface BandwidthProfile {
  id: string;
  tenantId: string;
  oltId: string;
  name: string;
  uploadRate: number;
  downloadRate: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateBandwidthProfileInput {
  tenantId: string;
  oltId: string;
  name: string;
  uploadRate: number;
  downloadRate: number;
  description?: string;
}

interface UpdateBandwidthProfileInput {
  name?: string;
  uploadRate?: number;
  downloadRate?: number;
  description?: string;
}

export class BandwidthProfileRepository {
  async findByOlt(
    oltId: string,
    tenantId: string,
  ): Promise<BandwidthProfile[]> {
    const profiles = await prisma.oltBandwidthProfile.findMany({
      where: { oltId, tenantId },
      orderBy: { name: "asc" },
    });
    return profiles as BandwidthProfile[];
  }

  async findByTenant(tenantId: string): Promise<BandwidthProfile[]> {
    const profiles = await prisma.oltBandwidthProfile.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return profiles as BandwidthProfile[];
  }

  async findByName(
    oltId: string,
    tenantId: string,
    name: string,
  ): Promise<BandwidthProfile | null> {
    const profile = await prisma.oltBandwidthProfile.findFirst({
      where: { oltId, tenantId, name },
    });
    return profile as BandwidthProfile | null;
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<BandwidthProfile | null> {
    const profile = await prisma.oltBandwidthProfile.findFirst({
      where: { id, tenantId },
    });
    return profile as BandwidthProfile | null;
  }

  async create(input: CreateBandwidthProfileInput): Promise<BandwidthProfile> {
    const profile = await prisma.oltBandwidthProfile.create({
      data: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        name: input.name,
        uploadRate: input.uploadRate,
        downloadRate: input.downloadRate,
        description: input.description ?? null,
      },
    });
    return profile as BandwidthProfile;
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateBandwidthProfileInput,
  ): Promise<BandwidthProfile> {
    const result = await prisma.oltBandwidthProfile.updateMany({
      where: { id, tenantId },
      data: input,
    });
    if (result.count === 0) {
      throw new Error("Bandwidth profile tidak ditemukan");
    }
    const profile = await prisma.oltBandwidthProfile.findUnique({
      where: { id },
    });
    return profile as BandwidthProfile;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const result = await prisma.oltBandwidthProfile.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0) {
      throw new Error("Bandwidth profile tidak ditemukan");
    }
  }
}
