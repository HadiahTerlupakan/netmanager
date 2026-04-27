import { LogType, Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

type SystemLogInput = {
  typeKey?: string | null;
  action?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
  requestedSiteId?: string | null;
  restrictedSiteIds?: string[];
};

function buildUserFilter(input: SystemLogInput) {
  if (input.restrictedSiteIds && input.restrictedSiteIds.length > 0) {
    return { siteId: { in: input.restrictedSiteIds } };
  }
  if (input.requestedSiteId) {
    return { siteId: input.requestedSiteId };
  }
  return undefined;
}

function buildWhere(input: SystemLogInput) {
  const where: Prisma.SystemLogWhereInput = {};
  if (input.search) {
    where.OR = [
      { subject: { contains: input.search, mode: "insensitive" } },
      { action: { contains: input.search, mode: "insensitive" } },
      { details: { contains: input.search, mode: "insensitive" } },
      { user: { name: { contains: input.search, mode: "insensitive" } } },
      { user: { email: { contains: input.search, mode: "insensitive" } } },
    ];
  }
  if (
    input.typeKey &&
    Object.values(LogType).includes(input.typeKey as LogType)
  ) {
    where.type = input.typeKey as LogType;
  }
  if (input.action) {
    where.action = input.action;
  }
  const userFilter = buildUserFilter(input);
  if (userFilter) where.user = userFilter;
  return where;
}

export class SystemLogRouteService {
  /** Get paginated system logs with search and site restriction. */
  async getLogs(input: SystemLogInput) {
    const page = input.page || DEFAULT_PAGE;
    const limit = input.limit || DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const where = buildWhere(input);
    const [total, logs] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
