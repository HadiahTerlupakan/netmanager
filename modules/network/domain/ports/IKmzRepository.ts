import type {
  KmzFileCreateData,
  KmzFileEntity,
  KmzFileUpdateData,
} from "../entities/KmzEntity";

export interface IKmzRepository {
  /** Get all KMZ file entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<KmzFileEntity[]>;

  /** Get one KMZ file entity by id. */
  findById(id: string): Promise<KmzFileEntity | null>;

  /** Get active KMZ file entities. */
  findActive(siteId?: string): Promise<KmzFileEntity[]>;

  /** Create a new KMZ file entity. */
  create(data: KmzFileCreateData): Promise<{ id: string }>;

  /** Update an existing KMZ file entity. */
  update(id: string, data: KmzFileUpdateData): Promise<void>;

  /** Delete a KMZ file entity by id. */
  delete(id: string): Promise<void>;

  /** Count all KMZ file entities. */
  count(): Promise<number>;
}
