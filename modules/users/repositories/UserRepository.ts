import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  AttendanceGeofencePolicy,
  WorkingHourMode,
  Prisma,
} from "@prisma/client";
import type { User } from "@prisma/client";

export interface CreateUserDTO {
  email: string;
  name?: string | null;
  passwordHash: string;
  phone?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  roleId?: string | null;
  isActive?: boolean;
  // Working Hours Settings
  workingHourMode?: WorkingHourMode;
  attendanceGeofencePolicy?: AttendanceGeofencePolicy;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
  // Sales Feature
  isSales?: boolean;
  canvasingTarget?: number;
  targetSchema?: string;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  // Salary configuration
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

export interface UserWithRelations extends User {
  department?: { id: string; name: string } | null;
  site?: { id: string; code: string; name: string } | null;
  role?: { id: string; name: string } | null;
  userSites?: Array<{
    id: string;
    siteId: string;
    isPrimary: boolean;
    site: { id: string; code: string; name: string };
  }>;
}

export class UserRepository {
  async findAll(
    params: {
      siteId?: string;
      tenantId?: string;
      roleName?: string;
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{
    data: UserWithRelations[];
    total: number;
    active: number;
    inactive: number;
  }> {
    const { siteId, tenantId, roleName, page, limit, search, isActive } =
      params;

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

    const where: Prisma.UserWhereInput = {};
    if (siteId) where.siteId = siteId;
    if (tenantId) where.tenantId = tenantId;
    if (roleName) {
      where.role = {
        name: {
          equals: roleName,
          mode: "insensitive",
        },
      };
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
      // Prisma join search can be more tricky if we want to search department names.
      // We'll add department search if needed, but for now email, name, phone is standard.
      // If they really need department search, it would look like:
      // { departments: { name: { contains: search, mode: 'insensitive' } } }
      where.OR.push({
        departments: { name: { contains: search, mode: "insensitive" } },
      });
    }

    if (Object.keys(where).length > 0) {
      query.where = where;
    }

    // Calculate pagination
    if (page && limit) {
      query.skip = (page - 1) * limit;
      query.take = limit;
    }

    const [users, total, active] = await prisma.$transaction([
      prisma.user.findMany(query),
      prisma.user.count({ where: query.where }),
      prisma.user.count({ where: { ...query.where, isActive: true } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      data: users.map((user) => {
        const userWithMeta = user as unknown as {
          departments: { id: string; name: string } | null;
          sites: { id: string; code: string; name: string } | null;
          role: { id: string; name: string } | null;
          userSites: Array<{
            id: string;
            siteId: string;
            isPrimary: boolean;
            site: { id: string; code: string; name: string };
          }>;
        } & User;

        return {
          ...user,
          department: userWithMeta.departments,
          site: userWithMeta.sites,
          role: userWithMeta.role,
          userSites: userWithMeta.userSites,
        };
      }),
    };
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
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
      },
    }) as unknown as Promise<User | null>;
  }

  async findByIdWithRelations(id: string): Promise<UserWithRelations | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true } },
        sites: { select: { id: true, code: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    if (!user) return null;

    return {
      ...user,
      department: (user as Record<string, unknown>).departments as {
        id: string;
        name: string;
      } | null,
      site: (user as Record<string, unknown>).sites as {
        id: string;
        code: string;
        name: string;
      } | null,
      role: (user as Record<string, unknown>).role as {
        id: string;
        name: string;
      } | null,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        email: data.email,
        name: data.name || null,
        passwordHash: data.passwordHash,
        phone: data.phone || null,
        departmentId: data.departmentId || null,
        siteId: data.siteId || null,
        roleId: data.roleId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isAttendanceRequired:
          data.isAttendanceRequired !== undefined
            ? data.isAttendanceRequired
            : true,
        // Working Hours Settings
        workingHourMode: data.workingHourMode || WorkingHourMode.FIXED,
        attendanceGeofencePolicy:
          data.attendanceGeofencePolicy || AttendanceGeofencePolicy.WARN,
        startWorkTime: data.startWorkTime || "09:00",
        endWorkTime: data.endWorkTime || "17:00",
        workDays: data.workDays || "Mon,Tue,Wed,Thu,Fri",
        flexibleTargetHour: data.flexibleTargetHour || 8,
        shiftId: data.shiftId || null,
        // Sales Feature
        isSales: data.isSales || false,
        canvasingTarget:
          data.canvasingTarget !== undefined ? data.canvasingTarget : 50,
        targetSchema:
          (data.targetSchema as
            | Prisma.UserCreateInput["targetSchema"]
            | undefined) || "MONTHLY_RESET",
        // Salary configuration
        basicSalary: data.basicSalary || 0,
        payPeriodDay: data.payPeriodDay || 25,
        payDay: data.payDay || 1,
        woIncentiveEnabled: data.woIncentiveEnabled || false,
        woIncentiveRate: data.woIncentiveRate || 0,
        lateDeductionRate: data.lateDeductionRate || 0,
        absentDeductionRate: data.absentDeductionRate || 0,
        overtimeRateNormal: data.overtimeRateNormal || 0,
        overtimeRateHoliday: data.overtimeRateHoliday || 0,
        overtimeRateNational: data.overtimeRateNational || 0,
        overtimeCalcTypeNormal:
          (data.overtimeCalcTypeNormal as
            | Prisma.UserCreateInput["overtimeCalcTypeNormal"]
            | undefined) || "PER_HOUR",
        overtimeCalcTypeHoliday:
          (data.overtimeCalcTypeHoliday as
            | Prisma.UserCreateInput["overtimeCalcTypeHoliday"]
            | undefined) || "PER_HOUR",
        overtimeCalcTypeNational:
          (data.overtimeCalcTypeNational as
            | Prisma.UserCreateInput["overtimeCalcTypeNational"]
            | undefined) || "PER_HOUR",
        // Tenant Support: Allow manual tenantId for Super Admin bypass
        ...(data.tenantId && { tenantId: data.tenantId }),
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  async updateWorkingHours(
    id: string,
    data: {
      workingHourMode: WorkingHourMode;
      startWorkTime?: string | null;
      endWorkTime?: string | null;
      workDays?: string | null;
      flexibleTargetHour?: number | null;
      shiftId?: string | null;
    },
  ): Promise<User> {
    const updateData: Prisma.UserUncheckedUpdateInput = {
      workingHourMode: data.workingHourMode,
    };

    if (data.startWorkTime !== undefined)
      updateData.startWorkTime = data.startWorkTime;
    if (data.endWorkTime !== undefined)
      updateData.endWorkTime = data.endWorkTime;
    if (data.workDays !== undefined) updateData.workDays = data.workDays;
    if (data.flexibleTargetHour !== undefined)
      updateData.flexibleTargetHour = data.flexibleTargetHour;
    if (data.shiftId !== undefined) updateData.shiftId = data.shiftId;

    return prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Find user with their sites (multi-site via userSites + legacy single site).
   * Used by GeofenceService for geofence validation.
   */
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

  /**
   * Find user with basic info and siteId.
   * Used by OvertimeService for notification context.
   */
  async findByIdWithSite(id: string, tenantId?: string | null) {
    return prisma.user.findFirst({
      where: { id, tenantId },
      select: { name: true, siteId: true },
    });
  }

  /**
   * Find admins who should receive overtime notifications.
   * Includes SUPER_ADMINs and users with 'lembur:update' permission.
   */
  async findAdminsForNotification(
    tenantId: string | null | undefined,
    userSiteId: string | null | undefined,
  ) {
    const whereConditions: Prisma.UserWhereInput = {
      tenantId,
      OR: [
        { role: { name: "SUPER_ADMIN" } },
        {
          AND: [
            {
              role: {
                permission: {
                  some: {
                    resource: "lembur",
                    action: "update",
                  },
                },
              },
            },
            ...(userSiteId
              ? [
                  {
                    OR: [
                      { siteId: userSiteId },
                      { siteId: null },
                      { userSites: { some: { siteId: userSiteId } } },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };

    return prisma.user.findMany({
      where: whereConditions,
      select: { id: true },
    });
  }

  /**
   * Find user with work schedule information (workDays, workingHourMode).
   * Used by AttendanceValidationService for off-day checks.
   */
  async findWorkScheduleById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { workDays: true, workingHourMode: true },
    });
  }

  /**
   * Get user's geofence policy via raw query.
   * Used by GeofenceService for policy lookup.
   */
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

  /**
   * Find active users for attendance processing.
   * Excludes SUPER_ADMIN and FLEXIBLE working hour mode users.
   */
  async findActiveForAttendance(tenantId: string, userId?: string) {
    return prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(userId ? { id: userId } : {}),
        role: {
          name: { not: "SUPER_ADMIN" },
        },
        workingHourMode: {
          not: "FLEXIBLE",
        },
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

  /**
   * Find active users with push tokens and work schedule for attendance alerts.
   */
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

  /**
   * Find fixed-hour users for auto-alpha processing.
   */
  async findFixedHourUsersForAutoAlpha() {
    return prisma.user.findMany({
      where: {
        isActive: true,
        isAttendanceRequired: true,
        tenantId: { not: null },
        endWorkTime: { not: null },
        workingHourMode: "FIXED",
        role: {
          name: { not: "SUPER_ADMIN" },
        },
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        endWorkTime: true,
        workDays: true,
        workingHourMode: true,
        isAttendanceRequired: true,
      },
    });
  }

  /**
   * Find user by ID with tenant filter, selecting work schedule fields.
   */
  async findWorkScheduleByIdWithTenant(userId: string, tenantId: string) {
    return prisma.user.findUnique({
      where: { id: userId, tenantId },
      select: { workingHourMode: true, workDays: true },
    });
  }

  async findAttendanceSettingsById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        startWorkTime: true,
        endWorkTime: true,
        workingHourMode: true,
        attendanceGeofencePolicy: true,
        shiftId: true,
        shift: { select: { startTime: true, endTime: true } },
      },
    });
  }

  async findManyWithWorkConfig(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        workingHourMode: true,
        startWorkTime: true,
        endWorkTime: true,
        flexibleTargetHour: true,
        shift: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });
  }

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

  async findManyWithFullDetails(userIds: string[], tenantId?: string) {
    return prisma.user.findMany({
      where: {
        id: { in: userIds },
        ...(tenantId ? { tenantId } : {}),
      },
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

  async findByIdsWithDetails(userIds: string[]): Promise<
    Array<{
      id: string;
      name: string;
      image: string | null;
      role: { name: string } | null;
      departments: { name: string } | null;
      sites: { name: string } | null;
    }>
  > {
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

  async findManyByDepartmentAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ): Promise<Array<{ id: string }>> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      role: {
        permission: {
          some: {
            resource: "workorders",
            action: "read",
          },
        },
      },
    };
    if (departmentId) where.departmentId = departmentId;
    if (siteId) where.siteId = siteId;
    if (excludeUserId) where.id = { not: excludeUserId };

    return prisma.user.findMany({
      where,
      select: { id: true },
    });
  }

  async findManyWithPushToken(
    userIds: string[],
  ): Promise<Array<{ id: string; pushToken: string | null }>> {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pushToken: true },
    });
  }

  async findManyByDepartmentWithPushToken(
    departmentId: string,
  ): Promise<Array<{ id: string; pushToken: string | null }>> {
    return prisma.user.findMany({
      where: {
        isActive: true,
        departmentId,
        pushToken: { not: null },
      },
      select: { id: true, pushToken: true },
    });
  }

  async findByIdWithDepartment(
    userId: string,
  ): Promise<{ departmentId: string | null } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
  }

  async findManyActiveWithPushTokenAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ): Promise<Array<{ id: string; fcmTokens: string[] }>> {
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

  async findByIdWithPushToken(userId: string): Promise<{
    id: string;
    pushToken: string | null;
    fcmTokens: string[];
  } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pushToken: true, fcmTokens: true },
    });
  }

  async findManyWithPushTokenAndFilter(
    userIds: string[],
  ): Promise<Array<{ id: string; pushToken: string | null }>> {
    return prisma.user.findMany({
      where: {
        id: { in: userIds },
        pushToken: { not: null },
      },
      select: { id: true, pushToken: true },
    });
  }

  async clearPushTokens(tokens: string[]) {
    return prisma.user.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
  }

  async findManyWithCustomWhere(
    where: Prisma.UserWhereInput,
  ): Promise<Array<{ id: string }>> {
    return prisma.user.findMany({
      where,
      select: { id: true },
    });
  }

  async findManyWithDetailedRelations(where: Prisma.UserWhereInput) {
    return prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        departmentId: true,
        siteId: true,
        userSites: {
          select: { siteId: true },
        },
        role: {
          select: {
            name: true,
            permission: {
              where: {
                resource: "workorders",
                action: "site_only",
              },
              select: { id: true },
            },
          },
        },
      },
    });
  }
}
