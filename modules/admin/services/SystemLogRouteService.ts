import { LogType } from "@prisma/client";
import { SystemLogMapper } from "../mappers/SystemLogMapper";
import { SystemLogRepository } from "../repositories/SystemLogRepository";
import type { ISystemLogRepository } from "../domain/ports/ISystemLogRepository";

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

function resolveType(typeKey?: string | null) {
  if (!typeKey || !Object.values(LogType).includes(typeKey as LogType)) {
    return undefined;
  }
  return typeKey as LogType;
}

function resolveUserSiteIds(input: SystemLogInput) {
  if (input.restrictedSiteIds && input.restrictedSiteIds.length > 0) {
    return input.restrictedSiteIds;
  }
  return input.requestedSiteId ? [input.requestedSiteId] : undefined;
}

export class SystemLogRouteService {
  constructor(
    private readonly repository: ISystemLogRepository = new SystemLogRepository(),
  ) {}

  /** Get paginated system logs with search and site restriction. */
  async getLogs(input: SystemLogInput) {
    const page = input.page || DEFAULT_PAGE;
    const limit = input.limit || DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const result = await this.repository.findAll({
      type: resolveType(input.typeKey),
      action: input.action ?? undefined,
      search: input.search ?? undefined,
      skip,
      take: limit,
      userSiteIds: resolveUserSiteIds(input),
    });

    return {
      logs: SystemLogMapper.toListItems(result.data),
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}
