import { prisma } from "@/modules/database";
import type { OnuDevice } from "../domain/entities/onu-device.entity";

interface OnuListFilters {
  tenantId: string;
  oltId?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

interface OnuListResult {
  data: OnuDevice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class OnuRepository {
  async findById(id: string): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findUnique({ where: { id } });
    return onu as OnuDevice | null;
  }

  async findBySerialNumber(serialNumber: string): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findUnique({ where: { serialNumber } });
    return onu as OnuDevice | null;
  }

  async findByOltId(
    oltId: string,
    page: number,
    limit: number,
  ): Promise<OnuListResult> {
    const where = { oltId };
    const [data, total] = await Promise.all([
      prisma.onuDevice.findMany({
        where,
        orderBy: [{ ponPort: "asc" }, { onuIndex: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.onuDevice.count({ where }),
    ]);
    return {
      data: data as OnuDevice[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMany(filters: OnuListFilters): Promise<OnuListResult> {
    const where = this.buildWhere(filters);
    const [data, total] = await Promise.all([
      prisma.onuDevice.findMany({
        where,
        orderBy: [{ ponPort: "asc" }, { onuIndex: "asc" }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { olt: { select: { name: true, vendor: true } } },
      }),
      prisma.onuDevice.count({ where }),
    ]);
    return {
      data: data as unknown as OnuDevice[],
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findUnregistered(
    tenantId: string,
    oltId?: string,
  ): Promise<OnuDevice[]> {
    const where: Record<string, unknown> = { tenantId, status: "UNREGISTERED" };
    if (oltId) where.oltId = oltId;
    const data = await prisma.onuDevice.findMany({
      where,
      orderBy: { lastSeen: "desc" },
      include: { olt: { select: { name: true, vendor: true } } },
    });
    return data as unknown as OnuDevice[];
  }

  async create(input: {
    tenantId: string;
    oltId: string;
    serialNumber: string;
    ponPort: number;
    onuIndex: number;
    status?: string;
    vendor?: string;
    model?: string;
    lastSeen?: Date;
    vlanId?: number;
    bandwidthProfile?: string;
    pelangganId?: string;
    registeredAt?: Date;
  }): Promise<OnuDevice> {
    const onu = await prisma.onuDevice.create({
      data: input as Parameters<typeof prisma.onuDevice.create>[0]["data"],
    });
    return onu as unknown as OnuDevice;
  }

  async update(id: string, input: Partial<OnuDevice>): Promise<OnuDevice> {
    const {
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = input as Record<string, unknown>;
    const onu = await prisma.onuDevice.update({
      where: { id },
      data: data as Parameters<typeof prisma.onuDevice.update>[0]["data"],
    });
    return onu as unknown as OnuDevice;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await prisma.onuDevice.update({
      where: { id },
      data: { status: status as OnuDevice["status"] },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.onuDevice.delete({ where: { id } });
  }

  async upsertBySerialNumber(input: {
    tenantId: string;
    oltId: string;
    serialNumber: string;
    ponPort: number;
    onuIndex: number;
    status?: string;
    lastSeen?: Date;
  }): Promise<OnuDevice> {
    const onu = await prisma.onuDevice.upsert({
      where: { serialNumber: input.serialNumber },
      create: input as Parameters<typeof prisma.onuDevice.create>[0]["data"],
      update: {
        lastSeen: input.lastSeen,
        ponPort: input.ponPort,
        onuIndex: input.onuIndex,
      },
    });
    return onu as unknown as OnuDevice;
  }

  private buildWhere(filters: OnuListFilters) {
    const where: Record<string, unknown> = { tenantId: filters.tenantId };
    if (filters.oltId) where.oltId = filters.oltId;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { serialNumber: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    return where;
  }
}
