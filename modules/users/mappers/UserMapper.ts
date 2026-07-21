import type { Prisma, User } from "@prisma/client";
import type {
  EmployeeAssignmentDTO,
  UserDetailDTO,
  UserListItemDTO,
  UserOptionDTO,
  UserSessionDTO,
} from "../dto/UserDTO";
import type {
  UserEntity,
  UserScheduleEntity,
} from "../domain/entities/UserEntity";
import type { CreateUserRepositoryInput } from "../domain/ports/IUserRepository";
import {
  toDetailDTO,
  toEmployeeAssignmentDTO,
  toOptionDTO,
  toRepositoryCreateInput,
  toSessionDTO,
  toUserRelation,
  toUserShift,
  toUserSiteRelation,
  toUserSites,
  toWorkingHoursUpdate,
  toListDTO,
} from "./user-mapper.helpers";

export type { PrismaUserRelations };

type PrismaUserRelations = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "phone"
  | "image"
  | "departmentId"
  | "siteId"
  | "roleId"
  | "tenantId"
  | "isActive"
  | "isSales"
  | "isAttendanceRequired"
  | "workingHourMode"
  | "attendanceGeofencePolicy"
  | "startWorkTime"
  | "endWorkTime"
  | "workDays"
  | "flexibleTargetHour"
  | "shiftId"
  | "canvasingTarget"
  | "targetSchema"
  | "createdAt"
  | "updatedAt"
> & {
  passwordHash?: string | null;
  emailVerified?: Date | null;
  pushToken?: string | null;
  pushTokenUpdatedAt?: Date | null;
  tokenVersion?: number;
  lastVersionCode?: number | null;
  lastVersionName?: string | null;
  lastVersionUpdate?: Date | null;
  lastOtaUpdateId?: string | null;
  lastLoginAt?: Date | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  bpjsKesehatan?: boolean | null;
  bpjsKetenagakerjaan?: boolean | null;
  fcmTokens?: string[];
  joinDate?: Date | null;
  ptkpStatus?: string | null;
  employeeType?: string | null;
  basicSalary?: number | null;
  payPeriodDay?: number | null;
  payDay?: number | null;
  woIncentiveEnabled?: boolean | null;
  woIncentiveRate?: number | null;
  lateDeductionRate?: number | null;
  absentDeductionRate?: number | null;
  overtimeRateNormal?: number | null;
  overtimeRateHoliday?: number | null;
  overtimeRateNational?: number | null;
  overtimeCalcTypeNormal?: string | null;
  overtimeCalcTypeHoliday?: string | null;
  overtimeCalcTypeNational?: string | null;
  departments?: { id: string; name: string } | null;
  sites?: { id: string; code: string; name: string } | null;
  role?: { id: string; name: string } | null;
  tenant?: { id: string; name: string } | null;
  shift?: {
    id: string;
    name: string;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  userSites?: Array<{
    id: string;
    siteId: string;
    isPrimary: boolean;
    site: { id: string; code: string; name: string };
  }>;
};

export class UserMapper {
  /** Map Prisma user model into user domain entity. */
  static toDomain(user: PrismaUserRelations): UserEntity {
    return {
      ...user,
      department: toUserRelation(user.departments),
      site: toUserSiteRelation(user.sites),
      role: toUserRelation(user.role),
      tenant: toUserRelation(user.tenant),
      shift: toUserShift(user.shift),
      userSites: toUserSites(user.userSites),
    };
  }

  /** Map create input from service into repository input with defaults. */
  static toRepositoryCreateInput(
    input: CreateUserRepositoryInput,
  ): CreateUserRepositoryInput {
    return toRepositoryCreateInput(input);
  }

  /** Map schedule entity into Prisma unchecked update input. */
  static toWorkingHoursUpdate(
    data: UserScheduleEntity,
  ): Prisma.UserUncheckedUpdateInput {
    return toWorkingHoursUpdate(data) as Prisma.UserUncheckedUpdateInput;
  }

  /** Map user entity to list DTO. */
  static toListDTO(entity: UserEntity): UserListItemDTO {
    return toListDTO(entity);
  }

  /** Map user entities to list DTOs. */
  static toListDTOs(entities: UserEntity[]): UserListItemDTO[] {
    return entities.map((entity) => this.toListDTO(entity));
  }

  /** Map user entity to detail DTO. */
  static toDetailDTO(entity: UserEntity): UserDetailDTO {
    return toDetailDTO(entity);
  }

  /** Map user entity to session DTO. */
  static toSessionDTO(
    entity: UserEntity,
    permissions: string[] = [],
  ): UserSessionDTO {
    return toSessionDTO(entity, permissions);
  }

  /** Map user entity to option DTO. */
  static toOptionDTO(entity: UserEntity): UserOptionDTO {
    return toOptionDTO(entity);
  }

  /** Map user entities to option DTOs. */
  static toOptionDTOs(entities: UserEntity[]): UserOptionDTO[] {
    return entities.map((entity) => this.toOptionDTO(entity));
  }

  /** Map user entity to employee assignment DTO. */
  static toEmployeeAssignmentDTO(entity: UserEntity): EmployeeAssignmentDTO {
    return toEmployeeAssignmentDTO(entity);
  }

  /** Map user entities to employee assignment DTOs. */
  static toEmployeeAssignmentDTOs(
    entities: UserEntity[],
  ): EmployeeAssignmentDTO[] {
    return entities.map((entity) => this.toEmployeeAssignmentDTO(entity));
  }
}
