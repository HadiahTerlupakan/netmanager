import type {
  AccelPppServerCreateData,
  AccelPppServerEntity,
  AccelPppServerFilters,
  AccelPppServerStatusUpdate,
  AccelPppServerUpdateData,
} from "../entities/AccelPppServerEntity";

export interface IAccelPppServerRepository {
  /** Get all accel-ppp servers for one tenant. */
  findAll(tenantId: string | null): Promise<AccelPppServerEntity[]>;

  /** Get filtered accel-ppp servers. */
  findWithFilters(
    filters: AccelPppServerFilters,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity[]>;

  /** Get one server by id and tenant. */
  findById(
    id: string,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity | null>;

  /** Get one server by IP within a tenant scope. */
  findByIp(
    ipAddress: string,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity | null>;

  /** Get all servers across tenants — used by background monitor. */
  findAllForMonitor(): Promise<AccelPppServerEntity[]>;

  /** Create a new accel-ppp server entity. */
  create(data: AccelPppServerCreateData): Promise<AccelPppServerEntity>;

  /** Update an existing accel-ppp server entity. */
  update(
    id: string,
    data: AccelPppServerUpdateData,
    tenantId: string | null,
  ): Promise<void>;

  /** Update server runtime status (used by health monitor). */
  updateStatus(id: string, status: AccelPppServerStatusUpdate): Promise<void>;

  /** Delete a server by id. */
  delete(id: string, tenantId: string | null): Promise<void>;

  /** Count servers under tenant scope. */
  count(tenantId: string | null, siteId?: string): Promise<number>;
}
