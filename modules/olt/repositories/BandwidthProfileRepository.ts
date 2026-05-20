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
  async findByOlt(oltId: string): Promise<BandwidthProfile[]> {
    const profiles = await prisma.oltBandwidthProfile.findMany({
      where: { oltId },
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

  async findById(id: string): Promise<BandwidthProfile | null> {
    const profile = await prisma.oltBandwidthProfile.findUnique({
      where: { id },
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
    input: UpdateBandwidthProfileInput,
  ): Promise<BandwidthProfile> {
    const profile = await prisma.oltBandwidthProfile.update({
      where: { id },
      data: input,
    });
    return profile as BandwidthProfile;
  }

  async delete(id: string): Promise<void> {
    await prisma.oltBandwidthProfile.delete({ where: { id } });
  }
}
