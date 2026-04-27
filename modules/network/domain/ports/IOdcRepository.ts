import type {
  OdcCreateData,
  OdcEntity,
  OdcUpdateData,
} from "../entities/OdcEntity";

export interface IOdcRepository {
  /** Get all ODC entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<OdcEntity[]>;

  /** Get one ODC entity by id. */
  findById(id: string): Promise<OdcEntity | null>;

  /** Create a new ODC entity. */
  create(data: OdcCreateData): Promise<{ id: string }>;

  /** Update an existing ODC entity. */
  update(id: string, data: OdcUpdateData): Promise<void>;

  /** Delete an ODC entity by id. */
  delete(id: string): Promise<void>;

  /** Count all ODC entities. */
  count(): Promise<number>;
}
