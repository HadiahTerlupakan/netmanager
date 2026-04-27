import type {
  OdpCreateData,
  OdpEntity,
  OdpUpdateData,
} from "../entities/OdpEntity";

export interface IOdpRepository {
  /** Get all ODP entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<OdpEntity[]>;

  /** Get one ODP entity by id. */
  findById(id: string): Promise<OdpEntity | null>;

  /** Create a new ODP entity. */
  create(data: OdpCreateData): Promise<{ id: string }>;

  /** Update an existing ODP entity. */
  update(id: string, data: OdpUpdateData): Promise<void>;

  /** Delete an ODP entity by id. */
  delete(id: string): Promise<void>;

  /** Count all ODP entities. */
  count(): Promise<number>;
}
