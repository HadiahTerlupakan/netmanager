import { hash } from "bcryptjs";
import type {
  FindUsersParams,
  IUserRepository,
} from "../domain/ports/IUserRepository";
import { invalidatePermissionCache } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import type { UserDetailDTO } from "../dto/UserDTO";
import type {
  UserEntity,
  UserScheduleEntity,
} from "../domain/entities/UserEntity";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";
import {
  buildCreateUserInput,
  buildUpdateUserData,
  validateWorkingHoursPayload,
} from "./UserService.helpers";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserListResultDTO,
} from "./UserService.types";

const PASSWORD_HASH_ROUNDS = 10;
const USER_NOT_FOUND = "User tidak ditemukan";
const SCHEDULE_CACHE_KEY_PREFIX = "user:schedule:";

export type {
  CreateUserInput,
  UpdateUserInput,
  UserListResultDTO,
} from "./UserService.types";

export class UserService {
  private readonly userRepository: IUserRepository;

  constructor(userRepository: IUserRepository = createUserRepository()) {
    this.userRepository = userRepository;
  }

  /** Get users as safe list DTOs. */
  async getAllUsers(params: FindUsersParams = {}): Promise<UserListResultDTO> {
    const result = await this.userRepository.findAll(params);
    return {
      data: UserMapper.toListDTOs(result.data),
      total: result.total,
      active: result.active,
      inactive: result.inactive,
    };
  }

  /** Get user domain entity by ID for internal consumers. */
  async getUser(id: string): Promise<UserEntity | null> {
    return this.userRepository.findById(id);
  }

  /** Get user detail DTO by ID. */
  async getUserWithRelations(id: string): Promise<UserDetailDTO | null> {
    const user = await this.userRepository.findByIdWithRelations(id);
    return user ? UserMapper.toDetailDTO(user) : null;
  }

  /** Get user domain entity by email for internal consumers. */
  async getUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email);
  }

  /** Create a user and return domain entity. */
  async createUser(data: CreateUserInput): Promise<UserEntity> {
    await this.ensureEmailAvailable(data.email);
    const passwordHash = await hash(data.password, PASSWORD_HASH_ROUNDS);
    const user = await this.userRepository.create(
      buildCreateUserInput(data, passwordHash),
    );
    await invalidatePermissionCache(user.id);
    return user;
  }

  /** Update a user and return domain entity. */
  async updateUser(id: string, data: UpdateUserInput): Promise<UserEntity> {
    const existingUser = await this.getRequiredUser(id);
    await this.ensureUpdatedEmailAvailable(id, existingUser.email, data.email);
    const updatedUser = await this.userRepository.update(
      id,
      buildUpdateUserData(data),
    );
    await this.clearUserScheduleCache(id);
    await this.invalidateUserAuthCache(id, data);
    return updatedUser;
  }

  /** Delete a user and return domain entity. */
  async deleteUser(id: string): Promise<UserEntity> {
    await this.getRequiredUser(id);
    return this.userRepository.delete(id);
  }

  /** Update working-hour settings and return domain entity. */
  async updateWorkingHours(
    id: string,
    data: UserScheduleEntity,
  ): Promise<UserEntity> {
    validateWorkingHoursPayload(data);
    const updatedUser = await this.userRepository.updateWorkingHours(id, data);
    await this.clearUserScheduleCache(id);
    return updatedUser;
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const globalCheck = await checkGlobalIdentifier(email);
    if (!globalCheck.exists) return;
    throw new Error(`Email sudah terdaftar sebagai ${globalCheck.role}`);
  }

  private async ensureUpdatedEmailAvailable(
    id: string,
    currentEmail: string,
    nextEmail?: string,
  ): Promise<void> {
    if (!nextEmail || nextEmail === currentEmail) return;
    const globalCheck = await checkGlobalIdentifier(nextEmail, undefined, id);
    if (!globalCheck.exists) return;
    throw new Error(`Email sudah terdaftar sebagai ${globalCheck.role}`);
  }

  private async getRequiredUser(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (user) return user;
    throw new Error(USER_NOT_FOUND);
  }

  private async clearUserScheduleCache(userId: string): Promise<void> {
    await redis.del(`${SCHEDULE_CACHE_KEY_PREFIX}${userId}`);
  }

  private async invalidateUserAuthCache(
    userId: string,
    data: UpdateUserInput,
  ): Promise<void> {
    if (data.roleId === undefined && data.isActive === undefined) return;
    await invalidatePermissionCache(userId);
  }
}

let userServiceInstance: UserService | null = null;

/** Get singleton user service instance. */
export function getUserService(): UserService {
  if (!userServiceInstance) {
    userServiceInstance = new UserService();
  }
  return userServiceInstance;
}
