import type {
  UserEntity,
  UserListResultEntity,
  UserScheduleEntity,
} from "../entities/UserEntity";

export type UpdateUserRepositoryInput = Record<string, unknown>;
export type UserSiteAssignmentInput = { siteId: string; isPrimary?: boolean };

export interface FindUsersParams {
  siteId?: string;
  tenantId?: string;
  roleName?: string;
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateUserRepositoryInput {
  email: string;
  name?: string | null;
  passwordHash: string;
  phone?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  roleId?: string | null;
  isActive?: boolean;
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

export interface UploadPermissionContext {
  id: string;
  email: string;
  role: {
    name: string;
    accessAdminPanel: boolean;
    permission: Array<{ resource: string; action: string }>;
  } | null;
}

export interface IUserRepository {
  /** Get users with optional filters and pagination. */
  findAll(params?: FindUsersParams): Promise<UserListResultEntity>;
  /** Get a user by id. */
  findById(id: string): Promise<UserEntity | null>;
  /** Get a user with relations for detail view. */
  findByIdWithRelations(id: string): Promise<UserEntity | null>;
  /** Find a user by email. */
  findByEmail(email: string): Promise<UserEntity | null>;
  /** Find user context for upload permission checks. */
  findUploadPermissionContextById(
    id: string,
  ): Promise<UploadPermissionContext | null>;
  /** Create a user and return its domain entity. */
  create(data: CreateUserRepositoryInput): Promise<UserEntity>;
  /** Create a user with sites in a single transaction. */
  createWithSites(
    data: CreateUserRepositoryInput,
    userSites: Array<{ siteId: string; isPrimary?: boolean }>,
  ): Promise<UserEntity>;
  /** Update a user and return its domain entity. */
  update(id: string, data: UpdateUserRepositoryInput): Promise<UserEntity>;
  /** Delete a user and return its domain entity. */
  delete(id: string): Promise<UserEntity>;
  /** Update user and synchronize multi-site assignments in one persistence boundary. */
  updateWithSites(
    userId: string,
    data: UpdateUserRepositoryInput,
    userSites: UserSiteAssignmentInput[] | undefined,
  ): Promise<void>;
  /** Synchronize user multi-site assignments. */
  syncUserSites(
    userId: string,
    userSites: UserSiteAssignmentInput[],
  ): Promise<void>;
  /** Update working-hour settings and return its domain entity. */
  updateWorkingHours(id: string, data: UserScheduleEntity): Promise<UserEntity>;
}
