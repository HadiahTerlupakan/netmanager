import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningAuditLogRepository,
  CreatePlanningAuditLogInput,
  FindAuditLogFilters,
} from "../domain/ports/IPlanningAuditLogRepository";
import type {
  PlanningAuditLogEntity,
  AuditAction,
} from "../domain/entities/PlanningAuditLogEntity";
import { PlanningAuditLogMapper } from "../mappers/PlanningAuditLogMapper";

export class PlanningAuditLogRepository implements IPlanningAuditLogRepository {
  /**
   * Find audit log entry by ID
   */
  async findById(id: string): Promise<PlanningAuditLogEntity | null> {
    const log = await prisma.planningAuditLog.findUnique({
      where: { id },
    });

    return log ? PlanningAuditLogMapper.toEntity(log) : null;
  }

  /**
   * Find all audit logs for a specific planning with optional filters
   */
  async findByPlanningId(
    planningId: string,
    filters?: FindAuditLogFilters,
  ): Promise<{ items: PlanningAuditLogEntity[]; total: number }> {
    const {
      tenantId,
      action,
      performedById,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters ?? {};

    const where: Prisma.PlanningAuditLogWhereInput = {
      planningId,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (action) {
      where.action = action;
    }
    if (performedById) {
      where.performedById = performedById;
    }
    if (startDate || endDate) {
      where.performedAt = {};
      if (startDate) {
        where.performedAt.gte = startDate;
      }
      if (endDate) {
        where.performedAt.lte = endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.planningAuditLog.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningAuditLog.count({ where }),
    ]);

    return {
      items: logs.map((log) => PlanningAuditLogMapper.toEntity(log)),
      total,
    };
  }

  /**
   * Find audit logs by specific action for a planning
   */
  async findByAction(
    planningId: string,
    action: AuditAction,
  ): Promise<PlanningAuditLogEntity[]> {
    const logs = await prisma.planningAuditLog.findMany({
      where: {
        planningId,
        action,
      },
      orderBy: { performedAt: "desc" },
    });

    return logs.map((log) => PlanningAuditLogMapper.toEntity(log));
  }

  /**
   * Create new audit log entry
   * Note: Audit logs are append-only, no update or delete methods
   */
  async create(
    data: CreatePlanningAuditLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningAuditLogEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningAuditLogCreateInput = {
      planning: {
        connect: { id: data.planningId },
      },
      tenant: {
        connect: { id: data.tenantId },
      },
      action: data.action,
      changes: (data.changes ?? null) as Prisma.InputJsonValue,
      notes: data.notes ?? null,
    };

    if (data.performedById) {
      prismaData.performedBy = {
        connect: { id: data.performedById },
      };
    }

    const created = await client.planningAuditLog.create({
      data: prismaData,
    });

    return PlanningAuditLogMapper.toEntity(created);
  }
}
