import { prisma } from "@/modules/database";
import type { OnuDevice } from "../domain/entities/onu-device.entity";

interface OnuListFilters {
  tenantId: string;
  oltId?: string;
  slotFrame?: number;
  slot?: number;
  ponPort?: number;
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

interface OnuCreateInput {
  tenantId: string;
  oltId: string;
  serialNumber: string;
  ponPort: number;
  onuIndex?: number | null;
  status?: string;
  vendor?: string;
  model?: string;
  lastSeen?: Date;
  vlanId?: number;
  bandwidthProfile?: string;
  pelangganId?: string;
  registeredAt?: Date;
}

type OnuUpdateInput = Partial<
  Omit<OnuDevice, "id" | "tenantId" | "createdAt" | "updatedAt">
>;

export class OnuRepository {
  async findById(id: string, tenantId: string): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findFirst({
      where: { id, tenantId },
    });
    return onu as OnuDevice | null;
  }

  async findBySerialNumber(
    tenantId: string,
    serialNumber: string,
  ): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findUnique({
      where: { tenantId_serialNumber: { tenantId, serialNumber } },
    });
    return onu as OnuDevice | null;
  }

  async findByOltSerialNumber(
    oltId: string,
    serialNumber: string,
  ): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findUnique({
      where: { oltId_serialNumber: { oltId, serialNumber } },
    });
    return onu as OnuDevice | null;
  }

  async findRegisteredAtPosition(
    oltId: string,
    ponPort: number,
    onuIndex: number,
  ): Promise<OnuDevice | null> {
    const onu = await prisma.onuDevice.findFirst({
      where: {
        oltId,
        ponPort,
        onuIndex,
        status: { not: "UNREGISTERED" },
      },
    });
    return onu as OnuDevice | null;
  }

  async findManyByOlt(oltId: string, tenantId: string): Promise<OnuDevice[]> {
    const data = await prisma.onuDevice.findMany({
      where: { oltId, tenantId, status: { not: "UNREGISTERED" } },
    });
    return data as OnuDevice[];
  }

  async findMany(filters: OnuListFilters): Promise<OnuListResult> {
    const where = this.buildWhere(filters);
    const [data, total] = await Promise.all([
      prisma.onuDevice.findMany({
        where,
        orderBy: [{ ponPort: "asc" }, { onuIndex: "asc" }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          olt: { select: { name: true, vendor: true } },
          pelanggan: { select: { nama: true } },
        },
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

  async create(input: OnuCreateInput): Promise<OnuDevice> {
    const onu = await prisma.onuDevice.create({
      data: input as Parameters<typeof prisma.onuDevice.create>[0]["data"],
    });
    return onu as unknown as OnuDevice;
  }

  async update(
    id: string,
    tenantId: string,
    input: OnuUpdateInput,
  ): Promise<OnuDevice> {
    const result = await prisma.onuDevice.updateMany({
      where: { id, tenantId },
      data: input as Parameters<typeof prisma.onuDevice.updateMany>[0]["data"],
    });
    if (result.count === 0) {
      throw new Error("ONU tidak ditemukan");
    }
    const onu = await prisma.onuDevice.findUnique({ where: { id } });
    return onu as unknown as OnuDevice;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
  ): Promise<void> {
    await prisma.onuDevice.updateMany({
      where: { id, tenantId },
      data: { status: status as OnuDevice["status"] },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const result = await prisma.onuDevice.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0) {
      throw new Error("ONU tidak ditemukan");
    }
  }

  async upsertRegistered(input: {
    tenantId: string;
    oltId: string;
    serialNumber: string;
    slotFrame: number;
    slot: number;
    ponPort: number;
    onuIndex: number;
    description?: string | null;
    vendor?: string | null;
    model?: string | null;
    softwareVersion?: string | null;
    distance?: number | null;
    vlanId?: number | null;
    status?: OnuDevice["status"];
    rxPower?: number | null;
    txPower?: number | null;
  }): Promise<OnuDevice> {
    const status = input.status ?? "REGISTERED";
    const onu = await prisma.onuDevice.upsert({
      where: {
        oltId_serialNumber: {
          oltId: input.oltId,
          serialNumber: input.serialNumber,
        },
      },
      create: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        serialNumber: input.serialNumber,
        slotFrame: input.slotFrame,
        slot: input.slot,
        ponPort: input.ponPort,
        onuIndex: input.onuIndex,
        description: input.description ?? null,
        vendor: input.vendor ?? null,
        model: input.model ?? null,
        softwareVersion: input.softwareVersion ?? null,
        distance: input.distance ?? null,
        vlanId: input.vlanId ?? null,
        rxPower: input.rxPower ?? null,
        txPower: input.txPower ?? null,
        status,
        registeredAt: new Date(),
        lastSeen: new Date(),
      },
      update: {
        slotFrame: input.slotFrame,
        slot: input.slot,
        ponPort: input.ponPort,
        onuIndex: input.onuIndex,
        description: input.description ?? null,
        vendor: input.vendor ?? null,
        model: input.model ?? null,
        softwareVersion: input.softwareVersion ?? null,
        distance: input.distance ?? null,
        vlanId: input.vlanId ?? null,
        rxPower: input.rxPower ?? null,
        txPower: input.txPower ?? null,
        status,
        lastSeen: new Date(),
      },
    });
    return onu as unknown as OnuDevice;
  }

  async upsertUnregistered(input: {
    tenantId: string;
    oltId: string;
    serialNumber: string;
    ponPort: number;
    lastSeen: Date;
  }): Promise<OnuDevice> {
    const onu = await prisma.onuDevice.upsert({
      where: {
        oltId_serialNumber: {
          oltId: input.oltId,
          serialNumber: input.serialNumber,
        },
      },
      create: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        serialNumber: input.serialNumber,
        ponPort: input.ponPort,
        onuIndex: null,
        status: "UNREGISTERED",
        lastSeen: input.lastSeen,
      },
      update: {
        ponPort: input.ponPort,
        lastSeen: input.lastSeen,
      },
    });
    return onu as unknown as OnuDevice;
  }

  private buildWhere(filters: OnuListFilters) {
    const where: Record<string, unknown> = { tenantId: filters.tenantId };

    if (filters.search) {
      where.OR = [
        { serialNumber: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        {
          pelanggan: {
            nama: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    } else {
      if (filters.oltId) where.oltId = filters.oltId;
      if (filters.slotFrame !== undefined) where.slotFrame = filters.slotFrame;
      if (filters.slot !== undefined) where.slot = filters.slot;
      if (filters.ponPort !== undefined) where.ponPort = filters.ponPort;
    }

    if (filters.status) where.status = filters.status;
    return where;
  }
}
