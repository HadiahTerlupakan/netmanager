import type {
  MikroTikRouterCreateData,
  MikroTikRouterEntity,
  MikroTikRouterStatistics,
  MikroTikRouterUpdateData,
  PaginatedRouterResult,
  PaginationOptions,
  RouterFilters,
} from "../entities/MikroTikRouterEntity";

export interface IMikroTikRouterRepository {
  /** Get all router entities for one tenant. */
  findAll(tenantId: string): Promise<MikroTikRouterEntity[]>;

  /** Get filtered router entities with pagination. */
  findWithFilters(
    filters: RouterFilters,
    pagination: PaginationOptions,
    tenantId: string,
  ): Promise<PaginatedRouterResult>;

  /** Get one router entity by id and tenant. */
  findById(id: string, tenantId: string): Promise<MikroTikRouterEntity | null>;

  /** Create a new router entity. */
  create(data: MikroTikRouterCreateData): Promise<{ id: string }>;

  /** Update an existing router entity. */
  update(
    id: string,
    data: MikroTikRouterUpdateData,
    tenantId: string,
  ): Promise<void>;

  /** Delete a router entity by id. */
  delete(id: string, tenantId: string): Promise<void>;

  /** Count router entities. */
  count(tenantId: string, siteId?: string): Promise<number>;

  /** Get aggregate router statistics. */
  getStatistics(
    tenantId: string,
    siteId?: string,
  ): Promise<MikroTikRouterStatistics>;
}
