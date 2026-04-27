import { hash } from "bcryptjs";
import { WorkingHourMode, type Prisma } from "@prisma/client";
import { invalidatePermissionCache } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import type { UserDetailDTO, UserListItemDTO } from "../dto/UserDTO";
import type {
  UserEntity,
  UserScheduleEntity,
} from "../domain/entities/UserEntity";
import type {
  CreateUserRepositoryInput,
  FindUsersParams,
  IUserRepository,
} from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";

const PASSWORD_HASH_ROUNDS = 10;
const USER_NOT_FOUND = "User tidak ditemukan";
const SCHEDULE_CACHE_KEY_PREFIX = "user:schedule:";

type AttendanceGeofencePolicy = "STRICT" | "WARN" | "DISABLED";

export interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
  phone?: string;
  departmentId?: string;
  siteId?: string;
  roleId?: string;
  isActive?: boolean;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  isSales?: boolean;
  canvasingTarget?: number;
  targetSchema?: string;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  phone?: string;
  departmentId?: string | null;
  siteId?: string | null;
  roleId?: string | null;
  isActive?: boolean;
  tenantId?: string | null;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
  isSales?: boolean;
  canvasingTarget?: number;
  targetSchema?: string;
  isAttendanceRequired?: boolean;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
}

export interface UserListResultDTO {
  data: UserListItemDTO[];
  total: number;
  active: number;
  inactive: number;
}

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
      this.buildCreateInput(data, passwordHash),
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
      this.buildUpdateData(data),
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
    this.validateWorkingHours(data);
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

  private buildCreateInput(
    data: CreateUserInput,
    passwordHash: string,
  ): CreateUserRepositoryInput {
    return {
      email: data.email,
      name: data.name || null,
      passwordHash,
      phone: data.phone || null,
      departmentId: data.departmentId || null,
      siteId: data.siteId || null,
      roleId: data.roleId || null,
      isActive: data.isActive,
      workingHourMode:
        (data.workingHourMode as WorkingHourMode | undefined) ||
        WorkingHourMode.FIXED,
      attendanceGeofencePolicy:
        (data.attendanceGeofencePolicy as
          | AttendanceGeofencePolicy
          | undefined) || "WARN",
      startWorkTime: data.startWorkTime,
      endWorkTime: data.endWorkTime,
      workDays: data.workDays,
      flexibleTargetHour: data.flexibleTargetHour,
      shiftId: data.shiftId || null,
      isSales: data.isSales || false,
      canvasingTarget: data.canvasingTarget,
      targetSchema: data.targetSchema,
      isAttendanceRequired: data.isAttendanceRequired ?? true,
      tenantId: data.tenantId || null,
      basicSalary: data.basicSalary,
      payPeriodDay: data.payPeriodDay,
      payDay: data.payDay,
      woIncentiveEnabled: data.woIncentiveEnabled,
      woIncentiveRate: data.woIncentiveRate,
      lateDeductionRate: data.lateDeductionRate,
      absentDeductionRate: data.absentDeductionRate,
      overtimeRateNormal: data.overtimeRateNormal,
      overtimeRateHoliday: data.overtimeRateHoliday,
      overtimeRateNational: data.overtimeRateNational,
      overtimeCalcTypeNormal: data.overtimeCalcTypeNormal,
      overtimeCalcTypeHoliday: data.overtimeCalcTypeHoliday,
      overtimeCalcTypeNational: data.overtimeCalcTypeNational,
    };
  }

  private buildUpdateData(
    data: UpdateUserInput,
  ): Prisma.UserUncheckedUpdateInput {
    const updateData: Prisma.UserUncheckedUpdateInput = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.departmentId !== undefined)
      updateData.departmentId = data.departmentId || null;
    if (data.siteId !== undefined) updateData.siteId = data.siteId || null;
    if (data.workingHourMode !== undefined) {
      updateData.workingHourMode = data.workingHourMode as WorkingHourMode;
    }
    if (data.attendanceGeofencePolicy !== undefined) {
      updateData.attendanceGeofencePolicy =
        data.attendanceGeofencePolicy as AttendanceGeofencePolicy;
    }
    if (data.startWorkTime !== undefined)
      updateData.startWorkTime = data.startWorkTime;
    if (data.endWorkTime !== undefined)
      updateData.endWorkTime = data.endWorkTime;
    if (data.workDays !== undefined) updateData.workDays = data.workDays;
    if (data.flexibleTargetHour !== undefined) {
      updateData.flexibleTargetHour = data.flexibleTargetHour;
    }
    if (data.shiftId !== undefined) updateData.shiftId = data.shiftId || null;
    if (data.isSales !== undefined) updateData.isSales = data.isSales;
    if (data.isAttendanceRequired !== undefined) {
      updateData.isAttendanceRequired = data.isAttendanceRequired;
    }
    if (data.roleId !== undefined) updateData.roleId = data.roleId || null;
    if (data.tenantId !== undefined)
      updateData.tenantId = data.tenantId || null;
    if (data.canvasingTarget !== undefined) {
      updateData.canvasingTarget = data.canvasingTarget;
    }
    if (data.targetSchema !== undefined) {
      updateData.targetSchema =
        data.targetSchema as Prisma.UserUncheckedUpdateInput["targetSchema"];
    }
    if (data.basicSalary !== undefined)
      updateData.basicSalary = data.basicSalary;
    if (data.payPeriodDay !== undefined)
      updateData.payPeriodDay = data.payPeriodDay;
    if (data.payDay !== undefined) updateData.payDay = data.payDay;
    if (data.woIncentiveEnabled !== undefined) {
      updateData.woIncentiveEnabled = data.woIncentiveEnabled;
    }
    if (data.woIncentiveRate !== undefined) {
      updateData.woIncentiveRate = data.woIncentiveRate;
    }
    if (data.lateDeductionRate !== undefined) {
      updateData.lateDeductionRate = data.lateDeductionRate;
    }
    if (data.absentDeductionRate !== undefined) {
      updateData.absentDeductionRate = data.absentDeductionRate;
    }
    if (data.overtimeRateNormal !== undefined) {
      updateData.overtimeRateNormal = data.overtimeRateNormal;
    }
    if (data.overtimeRateHoliday !== undefined) {
      updateData.overtimeRateHoliday = data.overtimeRateHoliday;
    }
    if (data.overtimeRateNational !== undefined) {
      updateData.overtimeRateNational = data.overtimeRateNational;
    }
    if (data.overtimeCalcTypeNormal !== undefined) {
      updateData.overtimeCalcTypeNormal =
        data.overtimeCalcTypeNormal as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeNormal"];
    }
    if (data.overtimeCalcTypeHoliday !== undefined) {
      updateData.overtimeCalcTypeHoliday =
        data.overtimeCalcTypeHoliday as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeHoliday"];
    }
    if (data.overtimeCalcTypeNational !== undefined) {
      updateData.overtimeCalcTypeNational =
        data.overtimeCalcTypeNational as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeNational"];
    }
    return updateData;
  }

  private validateWorkingHours(data: UserScheduleEntity): void {
    if (data.workingHourMode === WorkingHourMode.FIXED) {
      this.validateFixedWorkingHours(data);
    }
    if (data.workingHourMode !== WorkingHourMode.SHIFT) return;
    if (data.shiftId) return;
    throw new Error("Shift wajib dipilih untuk mode Shift");
  }

  private validateFixedWorkingHours(data: UserScheduleEntity): void {
    if (!data.startWorkTime || !data.endWorkTime) {
      throw new Error(
        "Waktu mulai dan waktu selesai diperlukan untuk mode Fixed",
      );
    }
    if (data.workDays) return;
    throw new Error("Hari kerja diperlukan untuk mode Fixed");
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
