import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";
import { hash } from "bcryptjs";
import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import { checkSiteRestriction, canAccessSite } from "@/modules/roles";
import { updateUserSchema } from "@/lib/validations/user";
import type { Session } from "next-auth";
import {
  Prisma,
  AttendanceGeofencePolicy,
  RateType,
  TargetSchema,
  WorkingHourMode,
} from "@prisma/client";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Mengambil detail pengguna berdasarkan ID. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["users:read"],
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params } = ctx;
    const { id } = params;

    if (!session) return ApiErrors.unauthorized();
    if (!id) return ApiErrors.badRequest("User ID is required");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        departmentId: true,
        siteId: true,
        roleId: true,
        workingHourMode: true,
        attendanceGeofencePolicy: true,
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        flexibleTargetHour: true,
        canvasingTarget: true,
        targetSchema: true,
        isSales: true,
        shiftId: true,
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
        shift: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
        departments: {
          select: { id: true, name: true },
        },
        sites: {
          select: { id: true, code: true, name: true },
        },
        role: {
          select: { id: true, name: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
        userSites: {
          select: {
            id: true,
            siteId: true,
            isPrimary: true,
            site: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    });

    if (!user) return ApiErrors.notFound("User");

    const isSelfView = session.user.id === id;

    if (
      !isSelfView &&
      !canAccessSite(session as Session, "users", user.siteId)
    ) {
      return ApiErrors.forbidden("Anda hanya dapat melihat user di site Anda");
    }

    logger.apiRequest(
      "GET",
      `/api/admin/users/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: id,
      },
    );

    return apiSuccess({ user });
  },
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update user
 *     description: Mengupdate data pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["users:update"],
    schema: updateUserSchema,
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params, validated: body } = ctx;
    const { id } = params;

    if (!session) return ApiErrors.unauthorized();
    if (!id) return ApiErrors.badRequest("User ID is required");

    const isSelfUpdate = session.user.id === id;

    const currentData = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roleId: true,
        siteId: true,
        departmentId: true,
        isActive: true,
        tenantId: true,
      },
    });

    if (!currentData) return ApiErrors.notFound("User");

    if (isSelfUpdate) {
      if (body.roleId !== undefined && body.roleId !== currentData.roleId) {
        return ApiErrors.forbidden("Tidak dapat mengubah role sendiri");
      }
      if (body.siteId !== undefined && body.siteId !== currentData.siteId) {
        return ApiErrors.forbidden("Tidak dapat mengubah site sendiri");
      }
      if (
        body.departmentId !== undefined &&
        body.departmentId !== currentData.departmentId
      ) {
        return ApiErrors.forbidden("Tidak dapat mengubah departemen sendiri");
      }
      if (
        body.isActive !== undefined &&
        body.isActive !== currentData.isActive
      ) {
        return ApiErrors.forbidden("Tidak dapat mengubah status aktif sendiri");
      }
    }

    const { isRestricted, primarySiteId } = checkSiteRestriction(
      session as Session,
      "users",
    );

    if (isRestricted && !isSelfUpdate) {
      if (!canAccessSite(session as Session, "users", currentData.siteId)) {
        return ApiErrors.forbidden(
          "Anda hanya dapat mengupdate user di site Anda",
        );
      }
      if (body.siteId && body.siteId !== primarySiteId) {
        return ApiErrors.forbidden(
          "Anda tidak dapat mengubah site user ke site lain",
        );
      }
    }

    const { password, userSites, email, tenantId, ...updateData } = body;
    const data: Prisma.UserUncheckedUpdateInput = {};

    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.phone !== undefined) data.phone = updateData.phone;
    if (updateData.roleId !== undefined) data.roleId = updateData.roleId;
    if (updateData.siteId !== undefined) data.siteId = updateData.siteId;
    if (updateData.isAttendanceRequired !== undefined)
      data.isAttendanceRequired = updateData.isAttendanceRequired;
    if (updateData.departmentId !== undefined)
      data.departmentId = updateData.departmentId;
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.isSales !== undefined) data.isSales = updateData.isSales;
    if (updateData.workingHourMode !== undefined)
      data.workingHourMode = updateData.workingHourMode as WorkingHourMode;
    if (updateData.attendanceGeofencePolicy !== undefined)
      data.attendanceGeofencePolicy =
        updateData.attendanceGeofencePolicy as AttendanceGeofencePolicy;
    if (updateData.startWorkTime !== undefined)
      data.startWorkTime = updateData.startWorkTime;
    if (updateData.endWorkTime !== undefined)
      data.endWorkTime = updateData.endWorkTime;
    if (updateData.workDays !== undefined) data.workDays = updateData.workDays;
    if (updateData.flexibleTargetHour !== undefined)
      data.flexibleTargetHour = updateData.flexibleTargetHour;
    if (updateData.shiftId !== undefined) data.shiftId = updateData.shiftId;
    if (updateData.canvasingTarget !== undefined)
      data.canvasingTarget = updateData.canvasingTarget;
    if (updateData.targetSchema !== undefined)
      data.targetSchema = updateData.targetSchema as TargetSchema;
    if (updateData.basicSalary !== undefined)
      data.basicSalary = updateData.basicSalary;
    if (updateData.payPeriodDay !== undefined)
      data.payPeriodDay = updateData.payPeriodDay;
    if (updateData.payDay !== undefined) data.payDay = updateData.payDay;
    if (updateData.overtimeRateNormal !== undefined)
      data.overtimeRateNormal = updateData.overtimeRateNormal;
    if (updateData.overtimeRateHoliday !== undefined)
      data.overtimeRateHoliday = updateData.overtimeRateHoliday;
    if (updateData.overtimeRateNational !== undefined)
      data.overtimeRateNational = updateData.overtimeRateNational;
    if (updateData.overtimeCalcTypeNormal !== undefined)
      data.overtimeCalcTypeNormal =
        updateData.overtimeCalcTypeNormal as RateType;
    if (updateData.overtimeCalcTypeHoliday !== undefined)
      data.overtimeCalcTypeHoliday =
        updateData.overtimeCalcTypeHoliday as RateType;
    if (updateData.overtimeCalcTypeNational !== undefined)
      data.overtimeCalcTypeNational =
        updateData.overtimeCalcTypeNational as RateType;
    if (updateData.woIncentiveEnabled !== undefined)
      data.woIncentiveEnabled = updateData.woIncentiveEnabled;
    if (updateData.woIncentiveRate !== undefined)
      data.woIncentiveRate = updateData.woIncentiveRate;
    if (updateData.lateDeductionRate !== undefined)
      data.lateDeductionRate = updateData.lateDeductionRate;
    if (updateData.absentDeductionRate !== undefined)
      data.absentDeductionRate = updateData.absentDeductionRate;

    if (tenantId !== undefined) {
      if (session.user.isSuperAdmin) {
        data.tenantId = tenantId || null;
      } else if (tenantId !== currentData.tenantId) {
        return ApiErrors.forbidden(
          "Hanya Super Admin yang dapat mengubah tenantId",
        );
      }
    }

    if (email && email !== currentData.email) {
      const globalCheck = await checkGlobalIdentifier(email, "EMPLOYEE", id);
      if (globalCheck.exists) {
        return ApiErrors.conflict(
          `Email sudah terdaftar sebagai ${globalCheck.role}`,
        );
      }
      data.email = email;
    }

    if (password) {
      data.passwordHash = await hash(password, 10);
    }

    try {
      await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data,
        });

        if (userSites !== undefined && Array.isArray(userSites)) {
          await tx.userSite.deleteMany({ where: { userId: id } });

          if (userSites.length > 0) {
            await tx.userSite.createMany({
              data: userSites.map((us) => ({
                userId: id,
                siteId: us.siteId,
                isPrimary: us.isPrimary || false,
              })),
            });

            const primarySite = userSites.find((us) => us.isPrimary);
            if (primarySite) {
              await tx.user.update({
                where: { id },
                data: { siteId: primarySite.siteId },
              });
            }
          } else {
            await tx.user.update({
              where: { id },
              data: { siteId: null },
            });
          }
        }

        return updatedUser;
      });

      if (body.roleId !== undefined) {
        const { invalidatePermissionCache } = await import("@/lib/auth");
        await invalidatePermissionCache(id);

        void firebaseRealtimeService
          .publish({
            type: "user.permissions_update",
            scope: { kind: "user", id },
            payload: { userId: id },
          })
          .catch((error) => {
            console.error(
              "[users/update] Failed to publish realtime permissions update",
              error,
            );
          });
      }

      logger.apiRequest(
        "PATCH",
        `/api/admin/users/${id}`,
        200,
        Date.now() - startTime,
        {
          userId: session.user.id,
          targetUserId: id,
          changes: Object.keys(body),
        },
      );

      await logger.logActivity({
        action: "UPDATE",
        subject: "User",
        userId: session.user.id,
        details: { id, changes: Object.keys(body) },
      });

      return apiSuccess({ ok: true }, { message: "User berhasil diperbarui" });
    } catch (error) {
      throw error;
    }
  },
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Menghapus pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["users:delete"],
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params } = ctx;
    const { id } = params;

    if (!session) return ApiErrors.unauthorized();
    if (!id) return ApiErrors.badRequest("User ID is required");

    const { isRestricted } = checkSiteRestriction(session as Session, "users");

    if (isRestricted) {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { siteId: true, name: true },
      });

      if (!targetUser) return ApiErrors.notFound("User");

      if (!canAccessSite(session as Session, "users", targetUser.siteId)) {
        return ApiErrors.forbidden(
          "Anda hanya dapat menghapus user di site Anda",
        );
      }
    }

    const targetUserForLog = await prisma.user.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!targetUserForLog) return ApiErrors.notFound("User");

    await prisma.user.delete({ where: { id } });

    logger.apiRequest(
      "DELETE",
      `/api/admin/users/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: id,
      },
    );

    await logger.logActivity({
      action: "DELETE",
      subject: "User",
      userId: session.user.id,
      details: { id, name: targetUserForLog.name },
    });

    return apiSuccess({ ok: true }, { message: "User berhasil dihapus" });
  },
);
