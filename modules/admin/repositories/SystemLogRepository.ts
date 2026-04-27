/**
 * SystemLogRepository
 *
 * Database operations for SystemLog entity.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { SystemLogMapper } from "../mappers/SystemLogMapper";
import type {
  ISystemLogRepository,
  SystemLogFilters,
} from "../domain/ports/ISystemLogRepository";

const DEFAULT_ACTIVITY_LIMIT = 10;

export class SystemLogRepository implements ISystemLogRepository {
  /** Find all logs with filters. */
  async findAll(filters: SystemLogFilters = {}) {
    const where = this.buildWhereClause(filters);
    const [rows, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.systemLog.count({ where }),
    ]);

    return {
      data: rows.map((row) => SystemLogMapper.toDomain(row)),
      total,
    };
  }

  /** Find one log by identifier. */
  async findById(id: string) {
    const row = await prisma.systemLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return row ? SystemLogMapper.toDomain(row) : null;
  }

  /** Get recent log activity for timeline widgets. */
  async getRecentActivity(limit: number = DEFAULT_ACTIVITY_LIMIT) {
    const rows = await prisma.systemLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((row) => SystemLogMapper.toDomain(row));
  }

  /** Get grouped statistics by action. */
  async getStatsByAction(startDate?: Date, endDate?: Date) {
    const rows = await prisma.systemLog.groupBy({
      by: ["action"],
      where: this.buildDateRangeWhere(startDate, endDate),
      _count: { _all: true },
    });

    return rows.map((row) => SystemLogMapper.toActionStat(row));
  }

  /** Get grouped statistics by subject. */
  async getStatsBySubject(startDate?: Date, endDate?: Date) {
    const rows = await prisma.systemLog.groupBy({
      by: ["subject"],
      where: this.buildDateRangeWhere(startDate, endDate),
      _count: { _all: true },
    });

    return rows.map((row) => SystemLogMapper.toSubjectStat(row));
  }

  /** Count total logs using optional filters. */
  async count(filters: SystemLogFilters = {}) {
    return prisma.systemLog.count({ where: this.buildWhereClause(filters) });
  }

  private buildWhereClause(
    filters: SystemLogFilters,
  ): Prisma.SystemLogWhereInput {
    return {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...this.buildDateRangeWhere(filters.startDate, filters.endDate),
      ...this.buildSearchWhere(filters.search),
    };
  }

  private buildDateRangeWhere(
    startDate?: Date,
    endDate?: Date,
  ): Prisma.SystemLogWhereInput {
    if (!startDate && !endDate) {
      return {};
    }

    return {
      createdAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      },
    };
  }

  private buildSearchWhere(search?: string): Prisma.SystemLogWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { subject: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ],
    };
  }
}
