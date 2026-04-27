import { randomUUID } from "crypto";
import {
  AttendanceGeofencePolicy,
  Prisma,
  WorkingHourMode,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserMapper } from "../mappers/UserMapper";
import type {
  UserEntity,
  UserListResultEntity,
  UserScheduleEntity,
} from "../domain/entities/UserEntity";
import type {
  CreateUserRepositoryInput,
  FindUsersParams,
  IUserRepository,
} from "../domain/ports/IUserRepository";

const DEFAULT_REFERENCE_DATE_FILTER = "SUPER_ADMIN";
const WORKORDER_RESOURCE = "workorders";
const WORKORDER_ACTION_READ = "read";
const WORKORDER_ACTION_SITE_ONLY = "site_only";
const OVERTIME_RESOURCE = "lembur";
const OVERTIME_ACTION_UPDATE = "update";

export type UserWithRelations = UserEntity;

export class UserRepository implements IUserRepository {
  /** Get users with optional filters and pagination. */
  async findAll(params: FindUsersParams = {}): Promise<UserListResultEntity> {
    const query = this.buildFindAllQuery(params);
    const activeWhere = { ...(query.where ?? {}), isActive: true };
    const inactiveWhere = { ...(query.where ?? {}), isActive: false };
    const [users, total, activeCount, inactiveCount] =
      await prisma.$transaction([
        prisma.user.findMany(query),
        prisma.user.count({ where: query.where }),
        prisma.user.count({ where: activeWhere }),
        prisma.user.count({ where: inactiveWhere }),
      ]);

    return {
      total,
      active: params.isActive === false ? 0 : activeCount,
      inactive: params.isActive === true ? 0 : inactiveCount,
      data: users.map((user) => UserMapper.toDomain(user)),
    };
  }

  /** Get a user by ID. */
  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: this.buildBaseSelect(),
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  /** Get a user by ID with relations. */
  async findByIdWithRelations(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: this.buildDetailSelect(),
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  /** Find a user by email. */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? UserMapper.toDomain(user) : null;
  }

  /** Create a user entity. */
  async create(data: CreateUserRepositoryInput): Promise<UserEntity> {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        ...UserMapper.toRepositoryCreateInput(data),
        workingHourMode: data.workingHourMode as WorkingHourMode | undefined,
        attendanceGeofencePolicy: data.attendanceGeofencePolicy as
          | AttendanceGeofencePolicy
          | undefined,
        targetSchema:
          data.targetSchema as Prisma.UserCreateInput["targetSchema"],
        overtimeCalcTypeNormal:
          data.overtimeCalcTypeNormal as Prisma.UserCreateInput["overtimeCalcTypeNormal"],
        overtimeCalcTypeHoliday:
          data.overtimeCalcTypeHoliday as Prisma.UserCreateInput["overtimeCalcTypeHoliday"],
        overtimeCalcTypeNational:
          data.overtimeCalcTypeNational as Prisma.UserCreateInput["overtimeCalcTypeNational"],
      },
    });
    return UserMapper.toDomain(user);
  }

  /** Update a user entity. */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
    return UserMapper.toDomain(user);
  }

  /** Delete a user entity. */
  async delete(id: string): Promise<UserEntity> {
    const user = await prisma.user.delete({ where: { id } });
    return UserMapper.toDomain(user);
  }

  /** Synchronize user site assignments. */
  async syncUserSites(
    userId: string,
    userSites: Array<{ siteId: string; isPrimary?: boolean }>,
  ): Promise<void> {
    if (userSites.length === 0) return;
    await prisma.userSite.createMany({
      data: userSites.map((userSite) => ({
        userId,
        siteId: userSite.siteId,
        isPrimary: userSite.isPrimary || false,
      })),
    });

    const primarySite = userSites.find((userSite) => userSite.isPrimary);
    if (!primarySite) return;
    await prisma.user.update({
      where: { id: userId },
      data: { siteId: primarySite.siteId },
    });
  }

  /** Update working-hour settings for a user. */
  async updateWorkingHours(
    id: string,
    data: UserScheduleEntity,
  ): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: UserMapper.toWorkingHoursUpdate(data),
    });
    return UserMapper.toDomain(user);
  }

  /** Find user with their sites for geofence validation. */
  async findUserWithSites(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        userSites: {
          select: {
            site: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                attendanceRadius: true,
                isActive: true,
              },
            },
          },
        },
        sites: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            attendanceRadius: true,
            isActive: true,
          },
        },
      },
    });
  }

  /** Find user with basic info and site. */
  async findByIdWithSite(id: string, tenantId?: string | null) {
    return prisma.user.findFirst({
      where: { id, tenantId },
      select: { name: true, siteId: true },
    });
  }

  /** Find admins that should receive overtime notifications. */
  async findAdminsForNotification(
    tenantId: string | null | undefined,
    userSiteId: string | null | undefined,
  ) {
    return prisma.user.findMany({
      where: this.buildNotificationWhere(tenantId, userSiteId),
      select: { id: true },
    });
  }

  /** Find work schedule by user ID. */
  async findWorkScheduleById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { workDays: true, workingHourMode: true },
    });
  }

  /** Get geofence policy by user ID. */
  async getGeofencePolicy(userId: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<
      Array<{ attendanceGeofencePolicy: string | null }>
    >`
      SELECT "attendanceGeofencePolicy"
      FROM "User"
      WHERE "id" = ${userId}
      LIMIT 1
    `;
    return rows[0]?.attendanceGeofencePolicy ?? null;
  }

  /** Find active users for attendance processing. */
  async findActiveForAttendance(
    tenantId: string,
    userId?: string,
    referenceDate?: Date,
  ) {
    return prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        isAttendanceRequired: true,
        ...(userId ? { id: userId } : {}),
        ...(referenceDate ? this.buildJoinDateFilter(referenceDate) : {}),
        role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
        workingHourMode: { not: "FLEXIBLE" },
      },
      select: {
        id: true,
        name: true,
        workDays: true,
        workingHourMode: true,
        shiftId: true,
        shift: true,
      },
    });
  }

  /** Find active users with push token and schedule. */
  async findActiveWithPushTokenAndSchedule() {
    return prisma.user.findMany({
      where: {
        isActive: true,
        pushToken: { not: null },
        startWorkTime: { not: null },
      },
      select: {
        id: true,
        name: true,
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        pushToken: true,
      },
    });
  }

  /** Find fixed-hour users for auto-alpha processing. */
  async findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        isAttendanceRequired: true,
        tenantId: { not: null },
        endWorkTime: { not: null },
        ...(referenceDate ? this.buildJoinDateFilter(referenceDate) : {}),
        workingHourMode: "FIXED",
        role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        endWorkTime: true,
        workDays: true,
        workingHourMode: true,
        isAttendanceRequired: true,
        joinDate: true,
      },
    });
  }

  /** Find work schedule by user ID with tenant. */
  async findWorkScheduleByIdWithTenant(userId: string, tenantId: string) {
    return prisma.user.findUnique({
      where: { id: userId, tenantId },
      select: { workingHourMode: true, workDays: true },
    });
  }

  /** Find attendance settings by user ID. */
  async findAttendanceSettingsById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        startWorkTime: true,
        endWorkTime: true,
        workingHourMode: true,
        attendanceGeofencePolicy: true,
        shiftId: true,
        joinDate: true,
        shift: { select: { startTime: true, endTime: true } },
      },
    });
  }

  /** Find many users with work config. */
  async findManyWithWorkConfig(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        workingHourMode: true,
        startWorkTime: true,
        endWorkTime: true,
        flexibleTargetHour: true,
        shift: { select: { startTime: true, endTime: true } },
      },
    });
  }

  /** Find many users with basic info. */
  async findManyWithBasicInfo(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        image: true,
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });
  }

  /** Find many users with full details. */
  async findManyWithFullDetails(userIds: string[], tenantId?: string) {
    return prisma.user.findMany({
      where: { id: { in: userIds }, ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        name: true,
        image: true,
        role: { select: { name: true } },
        sites: { select: { id: true, name: true } },
        departments: { select: { id: true, name: true } },
      },
    });
  }

  /** Find user with sites by user ID. */
  async findWithSitesById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        sites: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
            attendanceRadius: true,
          },
        },
      },
    });
  }

  /** Find users by IDs with details. */
  async findByIdsWithDetails(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        image: true,
        role: { select: { name: true } },
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
    });
  }

  /** Find active users by department and site. */
  async findManyByDepartmentAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ): Promise<Array<{ id: string }>> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      role: {
        permission: {
          some: { resource: WORKORDER_RESOURCE, action: WORKORDER_ACTION_READ },
        },
      },
    };
    if (departmentId) where.departmentId = departmentId;
    if (siteId) where.siteId = siteId;
    if (excludeUserId) where.id = { not: excludeUserId };
    return prisma.user.findMany({ where, select: { id: true } });
  }

  /** Find many users with push token. */
  async findManyWithPushToken(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pushToken: true },
    });
  }

  /** Find many users by department with push token. */
  async findManyByDepartmentWithPushToken(departmentId: string) {
    return prisma.user.findMany({
      where: { isActive: true, departmentId, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
  }

  /** Find user department by user ID. */
  async findByIdWithDepartment(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
  }

  /** Find active users with push token and site filters. */
  async findManyActiveWithPushTokenAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      OR: [{ pushToken: { not: null } }, { fcmTokens: { isEmpty: false } }],
    };
    if (departmentId) where.departmentId = departmentId;
    if (siteId) where.siteId = siteId;
    if (excludeUserId) where.id = { not: excludeUserId };
    return prisma.user.findMany({
      where,
      select: { id: true, fcmTokens: true },
    });
  }

  /** Find user by ID with push token fields. */
  async findByIdWithPushToken(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pushToken: true, fcmTokens: true },
    });
  }

  /** Find users with non-null push token from ID list. */
  async findManyWithPushTokenAndFilter(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
  }

  /** Clear push tokens by token list. */
  async clearPushTokens(tokens: string[]) {
    return prisma.user.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
  }

  /** Find users by custom where clause. */
  async findManyWithCustomWhere(where: Prisma.UserWhereInput) {
    return prisma.user.findMany({ where, select: { id: true } });
  }

  /** Find users with detailed relations by custom where clause. */
  async findManyWithDetailedRelations(where: Prisma.UserWhereInput) {
    return prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        departmentId: true,
        siteId: true,
        userSites: { select: { siteId: true } },
        role: {
          select: {
            name: true,
            permission: {
              where: {
                resource: WORKORDER_RESOURCE,
                action: WORKORDER_ACTION_SITE_ONLY,
              },
              select: { id: true },
            },
          },
        },
      },
    });
  }

  private buildFindAllQuery(params: FindUsersParams): Prisma.UserFindManyArgs {
    const query: Prisma.UserFindManyArgs = {
      orderBy: { createdAt: "desc" },
      include: {
        departments: { select: { id: true, name: true } },
        sites: { select: { id: true, code: true, name: true } },
        role: { select: { id: true, name: true } },
        userSites: {
          select: {
            id: true,
            siteId: true,
            isPrimary: true,
            site: { select: { id: true, code: true, name: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    };

    const where = this.buildFindAllWhere(params);
    if (Object.keys(where).length > 0) query.where = where;
    if (params.page && params.limit) {
      query.skip = (params.page - 1) * params.limit;
      query.take = params.limit;
    }
    return query;
  }

  private buildFindAllWhere(params: FindUsersParams): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (params.siteId) where.siteId = params.siteId;
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.roleName) where.role = this.buildRoleNameFilter(params.roleName);
    if (params.search) where.OR = this.buildSearchFilter(params.search);
    return where;
  }

  private buildRoleNameFilter(roleName: string): Prisma.UserWhereInput["role"] {
    return { is: { name: { equals: roleName, mode: "insensitive" } } };
  }

  private buildSearchFilter(search: string): Prisma.UserWhereInput[] {
    return [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { departments: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  private buildBaseSelect() {
    return {
      id: true,
      email: true,
      name: true,
      phone: true,
      image: true,
      departmentId: true,
      siteId: true,
      roleId: true,
      isActive: true,
      isSales: true,
      isAttendanceRequired: true,
      workingHourMode: true,
      attendanceGeofencePolicy: true,
      startWorkTime: true,
      endWorkTime: true,
      workDays: true,
      flexibleTargetHour: true,
      shiftId: true,
      canvasingTarget: true,
      targetSchema: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private buildDetailSelect() {
    return {
      ...this.buildBaseSelect(),
      passwordHash: true,
      emailVerified: true,
      pushToken: true,
      pushTokenUpdatedAt: true,
      tokenVersion: true,
      lastVersionCode: true,
      lastVersionName: true,
      lastVersionUpdate: true,
      lastLoginAt: true,
      bankName: true,
      bankAccountNo: true,
      bankAccountName: true,
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      fcmTokens: true,
      joinDate: true,
      ptkpStatus: true,
      employeeType: true,
      basicSalary: true,
      payPeriodDay: true,
      payDay: true,
      woIncentiveEnabled: true,
      woIncentiveRate: true,
      lateDeductionRate: true,
      absentDeductionRate: true,
      overtimeRateNormal: true,
      overtimeRateHoliday: true,
      overtimeRateNational: true,
      overtimeCalcTypeNormal: true,
      overtimeCalcTypeHoliday: true,
      overtimeCalcTypeNational: true,
      departments: { select: { id: true, name: true } },
      sites: { select: { id: true, code: true, name: true } },
      role: { select: { id: true, name: true } },
      tenant: { select: { id: true, name: true } },
      userSites: {
        select: {
          id: true,
          siteId: true,
          isPrimary: true,
          site: { select: { id: true, code: true, name: true } },
        },
        orderBy: { isPrimary: "desc" },
      },
      shift: { select: { id: true, name: true } },
    } satisfies Prisma.UserSelect;
  }

  private buildJoinDateFilter(referenceDate: Date): Prisma.UserWhereInput {
    return {
      OR: [{ joinDate: null }, { joinDate: { lte: referenceDate } }],
    };
  }

  private buildNotificationWhere(
    tenantId: string | null | undefined,
    userSiteId: string | null | undefined,
  ): Prisma.UserWhereInput {
    return {
      tenantId,
      OR: [
        { role: { name: DEFAULT_REFERENCE_DATE_FILTER } },
        {
          AND: [
            {
              role: {
                permission: {
                  some: {
                    resource: OVERTIME_RESOURCE,
                    action: OVERTIME_ACTION_UPDATE,
                  },
                },
              },
            },
            ...this.buildNotificationSiteScope(userSiteId),
          ],
        },
      ],
    };
  }

  private buildNotificationSiteScope(
    userSiteId: string | null | undefined,
  ): Prisma.UserWhereInput[] {
    if (!userSiteId) return [];
    return [
      {
        OR: [
          { siteId: userSiteId },
          { siteId: null },
          { userSites: { some: { siteId: userSiteId } } },
        ],
      },
    ];
  }
}
