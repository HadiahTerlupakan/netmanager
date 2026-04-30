import { LogType } from "../types/admin.enums";
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
    const pagination = this.resolvePagination(input);
    const result = await this.repository.findAll({
      type: resolveType(input.typeKey),
      action: input.action ?? undefined,
      search: input.search ?? undefined,
      skip: pagination.skip,
      take: pagination.limit,
      userSiteIds: resolveUserSiteIds(input),
    });

    return {
      logs: SystemLogMapper.toListItems(result.data),
      pagination: this.buildPagination(result.total, pagination),
    };
  }

  /** Resolve pagination defaults for system log listing. */
  private resolvePagination(input: SystemLogInput) {
    const page = input.page || DEFAULT_PAGE;
    const limit = input.limit || DEFAULT_LIMIT;
    return { page, limit, skip: (page - 1) * limit };
  }

  /** Build pagination response metadata for listed logs. */
  private buildPagination(
    total: number,
    pagination: { page: number; limit: number },
  ) {
    return {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
