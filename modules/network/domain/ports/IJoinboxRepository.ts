import type {
  JoinboxCreateData,
  JoinboxEntity,
  JoinboxUpdateData,
} from "../entities/JoinboxEntity";

export interface IJoinboxRepository {
  /** Get all joinbox entities, optionally filtered by site. */
  findAll(siteId?: string): Promise<JoinboxEntity[]>;

  /** Get one joinbox entity by id. */
  findById(id: string): Promise<JoinboxEntity | null>;

  /** Create a new joinbox entity. */
  create(data: JoinboxCreateData): Promise<{ id: string }>;

  /** Update an existing joinbox entity. */
  update(id: string, data: JoinboxUpdateData): Promise<void>;

  /** Delete a joinbox entity by id. */
  delete(id: string): Promise<void>;

  /** Count all joinbox entities. */
  count(): Promise<number>;
}
