import { prisma } from "@/modules/database";
import type {
  OltDevice,
  OltDeviceCreateInput,
  OltDeviceListFilters,
  OltDeviceListResult,
  OltDeviceUpdateInput,
} from "../domain/entities/olt-device.entity";
import type { IOltRepository } from "../domain/ports/IOltRepository";

export class OltRepository implements IOltRepository {
  async findById(id: string): Promise<OltDevice | null> {
    const device = await prisma.oltDevice.findUnique({ where: { id } });
    return device as OltDevice | null;
  }

  async findAllActive(tenantId: string): Promise<OltDevice[]> {
    const devices = await prisma.oltDevice.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
    return devices as OltDevice[];
  }

  async findMany(filters: OltDeviceListFilters): Promise<OltDeviceListResult> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await Promise.all([
      prisma.oltDevice.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.oltDevice.count({ where }),
    ]);

    return {
      data: data as OltDevice[],
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async create(input: OltDeviceCreateInput): Promise<OltDevice> {
    const device = await prisma.oltDevice.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        vendor: input.vendor,
        model: input.model,
        ipAddress: input.ipAddress,
        snmpCommunity: input.snmpCommunity ?? null,
        snmpPort: input.snmpPort ?? 161,
        telnetPort: input.telnetPort ?? null,
        telnetUser: input.telnetUser ?? null,
        telnetPass: input.telnetPass ?? null,
        totalPonPorts: input.totalPonPorts,
        location: input.location ?? null,
      },
    });
    return device as OltDevice;
  }

  async update(id: string, input: OltDeviceUpdateInput): Promise<OltDevice> {
    const device = await prisma.oltDevice.update({
      where: { id },
      data: input,
    });
    return device as OltDevice;
  }

  async delete(id: string): Promise<void> {
    await prisma.oltDevice.delete({ where: { id } });
  }

  private buildWhereClause(filters: OltDeviceListFilters) {
    const where: Record<string, unknown> = { tenantId: filters.tenantId };

    if (filters.vendor) {
      where.vendor = filters.vendor;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { ipAddress: { contains: filters.search } },
        { model: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }
}
