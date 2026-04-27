import type {
  PoleCreateData,
  PoleEntity,
  PoleUpdateData,
} from "../entities/PoleEntity";

export interface IPoleRepository {
  /** Get all pole entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<PoleEntity[]>;

  /** Get one pole entity by id. */
  findById(id: string): Promise<PoleEntity | null>;

  /** Create a new pole entity. */
  create(data: PoleCreateData): Promise<{ id: string }>;

  /** Update an existing pole entity. */
  update(id: string, data: PoleUpdateData): Promise<void>;

  /** Delete a pole entity by id. */
  delete(id: string): Promise<void>;

  /** Count all pole entities. */
  count(): Promise<number>;
}
