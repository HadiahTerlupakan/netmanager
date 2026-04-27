import type { Prisma, User } from "@prisma/client";
import type { UserWithRelations } from "./UserRepository";

export interface IUserRepository {
  /** Get a user by id. */
  findById(id: string): Promise<User | null>;

  /** Get a user with relations for admin detail view. */
  findByIdWithRelations(id: string): Promise<UserWithRelations | null>;

  /** Update a user by id. */
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;

  /** Delete a user by id. */
  delete(id: string): Promise<User>;
}
