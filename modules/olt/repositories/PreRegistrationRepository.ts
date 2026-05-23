import { prisma } from "@/modules/database";

interface PreRegistration {
  id: string;
  tenantId: string;
  serialNumber: string;
  oltId: string | null;
  pelangganId: string | null;
  bandwidthProfile: string | null;
  vlanId: number | null;
  status: string;
  completedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

interface CreatePreRegInput {
  tenantId: string;
  serialNumber: string;
  oltId?: string;
  pelangganId?: string;
  bandwidthProfile?: string;
  vlanId?: number;
  createdBy: string;
}

export class PreRegistrationRepository {
  async findById(
    id: string,
    tenantId: string,
  ): Promise<PreRegistration | null> {
    const record = await prisma.onuPreRegistration.findFirst({
      where: { id, tenantId },
    });
    return record as PreRegistration | null;
  }

  async findPendingBySerialNumber(
    tenantId: string,
    serialNumber: string,
  ): Promise<PreRegistration | null> {
    const record = await prisma.onuPreRegistration.findFirst({
      where: { tenantId, serialNumber, status: "PENDING" },
    });
    return record as PreRegistration | null;
  }

  async findPending(tenantId: string): Promise<PreRegistration[]> {
    const records = await prisma.onuPreRegistration.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    return records as PreRegistration[];
  }

  async findAll(tenantId: string, page: number, limit: number) {
    const where = { tenantId };
    const [data, total] = await Promise.all([
      prisma.onuPreRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.onuPreRegistration.count({ where }),
    ]);
    return {
      data: data as PreRegistration[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(input: CreatePreRegInput): Promise<PreRegistration> {
    const record = await prisma.onuPreRegistration.create({
      data: {
        tenantId: input.tenantId,
        serialNumber: input.serialNumber,
        oltId: input.oltId ?? null,
        pelangganId: input.pelangganId ?? null,
        bandwidthProfile: input.bandwidthProfile ?? null,
        vlanId: input.vlanId ?? null,
        createdBy: input.createdBy,
      },
    });
    return record as PreRegistration;
  }

  async markCompleted(id: string, tenantId: string): Promise<void> {
    await prisma.onuPreRegistration.updateMany({
      where: { id, tenantId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  async markExpired(id: string, tenantId: string): Promise<void> {
    await prisma.onuPreRegistration.updateMany({
      where: { id, tenantId },
      data: { status: "EXPIRED" },
    });
  }

  async cancel(id: string, tenantId: string): Promise<void> {
    await prisma.onuPreRegistration.updateMany({
      where: { id, tenantId },
      data: { status: "CANCELLED" },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.onuPreRegistration.deleteMany({ where: { id, tenantId } });
  }
}
