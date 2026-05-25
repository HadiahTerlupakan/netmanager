import { prisma } from "@/lib/prisma";
import type { IncidentSeverity, IncidentStatus } from "@prisma/client";

export interface IncidentEntity {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedAreas: string[];
  startedAt: Date;
  resolvedAt: Date | null;
  isPublic: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}

export interface IncidentWithUpdates extends IncidentEntity {
  updates: IncidentUpdateEntity[];
  user?: { id: string; name: string | null } | null;
}

export interface IncidentUpdateEntity {
  id: string;
  incidentId: string;
  status: IncidentStatus;
  message: string;
  postedById: string | null;
  createdAt: Date;
  tenantId: string | null;
  user?: { id: string; name: string | null } | null;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedAreas: string[];
  isPublic?: boolean;
}

export interface UpdateIncidentStatusInput {
  status: IncidentStatus;
  message: string;
}

const updateInclude = {
  user: { select: { id: true, name: true } },
};

const incidentInclude = {
  updates: { include: updateInclude, orderBy: { createdAt: "desc" } },
  user: { select: { id: true, name: true } },
} as const;

/** Repository untuk incident management. */
export class IncidentRepository {
  async findMany(filters: {
    status?: IncidentStatus | "ACTIVE";
    publicOnly?: boolean;
    limit?: number;
  }): Promise<IncidentEntity[]> {
    const { status, publicOnly, limit = 50 } = filters;

    const where: Record<string, unknown> = {};
    if (publicOnly) where.isPublic = true;
    if (status === "ACTIVE") {
      where.status = { not: "RESOLVED" };
    } else if (status) {
      where.status = status;
    }

    return prisma.incident.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  async findById(id: string): Promise<IncidentWithUpdates | null> {
    return prisma.incident.findUnique({
      where: { id },
      include: incidentInclude,
    }) as Promise<IncidentWithUpdates | null>;
  }

  async create(
    input: CreateIncidentInput & { createdById: string },
  ): Promise<IncidentEntity> {
    return prisma.incident.create({
      data: {
        id: globalThis.crypto.randomUUID(),
        title: input.title,
        description: input.description,
        severity: input.severity,
        affectedAreas: input.affectedAreas,
        isPublic: input.isPublic ?? true,
        createdById: input.createdById,
        updatedAt: new Date(),
      },
    });
  }

  async addUpdate(
    incidentId: string,
    input: UpdateIncidentStatusInput & { postedById: string | null },
  ): Promise<IncidentUpdateEntity> {
    const now = new Date();
    const isResolved = input.status === "RESOLVED";

    const [, update] = await prisma.$transaction([
      prisma.incident.update({
        where: { id: incidentId },
        data: {
          status: input.status,
          updatedAt: now,
          ...(isResolved ? { resolvedAt: now } : {}),
        },
      }),
      prisma.incidentUpdate.create({
        data: {
          id: globalThis.crypto.randomUUID(),
          incidentId,
          status: input.status,
          message: input.message,
          postedById: input.postedById,
        },
        include: updateInclude,
      }),
    ]);

    return update as IncidentUpdateEntity;
  }

  async delete(id: string): Promise<void> {
    await prisma.incident.delete({ where: { id } });
  }
}

let instance: IncidentRepository | null = null;

export function getIncidentRepository(): IncidentRepository {
  instance ??= new IncidentRepository();
  return instance;
}
