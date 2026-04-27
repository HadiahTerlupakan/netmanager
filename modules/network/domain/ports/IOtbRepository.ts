import type {
  OtbCreateData,
  OtbEntity,
  OtbUpdateData,
} from "../entities/OtbEntity";

export interface IOtbRepository {
  /** Get all OTB entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<OtbEntity[]>;

  /** Get one OTB entity by id. */
  findById(id: string): Promise<OtbEntity | null>;

  /** Create a new OTB entity. */
  create(data: OtbCreateData): Promise<{ id: string }>;

  /** Update an existing OTB entity. */
  update(id: string, data: OtbUpdateData): Promise<void>;

  /** Delete an OTB entity by id. */
  delete(id: string): Promise<void>;

  /** Count all OTB entities. */
  count(): Promise<number>;
}
