import { prisma } from "@/modules/database";
import { OvertimeService } from "@/modules/overtime";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { lemburActionSchema } from "@/lib/validations/lembur";
import { logActivitySafe } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";

/**
 * GET /api/admin/lembur/[id]
 * Retrieve single overtime record
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("lembur:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  // Fetch overtime with user details
  const overtime = await prisma.overtime.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          siteId: true,
          departmentId: true,
          departments: { select: { name: true } },
          sites: { select: { name: true } },
        },
      },
    },
  });

  if (!overtime) {
    return ApiErrors.notFound("Data lembur tidak ditemukan");
  }

  // RBAC Filtering
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const { prisma: db } = await import("@/modules/database");
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { siteId: true, departmentId: true },
    });

    if (permissions.includes("lembur:site_only") && dbUser?.siteId) {
      if (overtime.user.siteId !== dbUser.siteId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
    if (
      permissions.includes("lembur:department_only") &&
      dbUser?.departmentId
    ) {
      if (overtime.user.departmentId !== dbUser.departmentId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
  }

  return apiSuccess(overtime);
});

/**
 * PATCH /api/admin/lembur/[id]
 * Update or verify overtime record
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;
  const body = await req.json();

  const parseResult = lemburActionSchema.safeParse(body);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const { action, reason, startTime, endTime } = parseResult.data;

  // Check ownership & site/dept restrictions first
  const existing = await prisma.overtime.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Data lembur tidak ditemukan");
  }

  // RBAC Filtering
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const { prisma: db } = await import("@/modules/database");
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { siteId: true, departmentId: true },
    });

    if (permissions.includes("lembur:site_only") && dbUser?.siteId) {
      if (existing.user.siteId !== dbUser.siteId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
    if (
      permissions.includes("lembur:department_only") &&
      dbUser?.departmentId
    ) {
      if (existing.user.departmentId !== dbUser.departmentId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
  }

  const service = new OvertimeService();

  if (action === "approve" || action === "reject") {
    if (!(await hasPermission("lembur:verify"))) {
      return ApiErrors.forbidden("Anda membutuhkan permission lembur:verify");
    }

    if (action === "approve") {
      const result = await service.approveRequest(id, user.id || "system");

      logActivitySafe({
        action: "UPDATE",
        subject: "Overtime",
        userId: user.id,
        details: { id, action: "APPROVE" },
      });
      return apiSuccess(result, { message: "Lembur berhasil disetujui" });
    } else {
      if (!reason) {
        return ApiErrors.badRequest("Alasan penolakan wajib diisi");
      }
      const result = await service.rejectRequest(id, reason);

      logActivitySafe({
        action: "UPDATE",
        subject: "Overtime",
        userId: user.id,
        details: { id, action: "REJECT", reason },
      });
      return apiSuccess(result, { message: "Lembur berhasil ditolak" });
    }
  } else {
    if (!(await hasPermission("lembur:update"))) {
      return ApiErrors.forbidden("Anda membutuhkan permission lembur:update");
    }

    const cleanData: { reason?: string; startTime?: Date; endTime?: Date } = {};
    if (reason) cleanData.reason = reason;
    if (startTime) cleanData.startTime = new Date(startTime);
    if (endTime) cleanData.endTime = new Date(endTime);

    const result = await prisma.overtime.update({
      where: { id },
      data: cleanData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            departments: { select: { name: true } },
            sites: { select: { name: true } },
          },
        },
      },
    });

    logActivitySafe({
      action: "UPDATE",
      subject: "Overtime",
      userId: user.id,
      details: { id, updates: cleanData },
    });

    return apiSuccess(result, { message: "Data lembur berhasil diperbarui" });
  }
});

/**
 * DELETE /api/admin/lembur/[id]
 * Remove overtime record
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("lembur:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const existing = await prisma.overtime.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Data lembur tidak ditemukan");
  }

  // RBAC Filtering
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const { prisma: db } = await import("@/modules/database");
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { siteId: true, departmentId: true },
    });

    if (permissions.includes("lembur:site_only") && dbUser?.siteId) {
      if (existing.user.siteId !== dbUser.siteId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
    if (
      permissions.includes("lembur:department_only") &&
      dbUser?.departmentId
    ) {
      if (existing.user.departmentId !== dbUser.departmentId) {
        return ApiErrors.notFound("Data lembur tidak ditemukan");
      }
    }
  }

  const service = new OvertimeService();
  await service.deleteOvertime(id);

  logActivitySafe({
    action: "DELETE",
    subject: "Overtime",
    userId: user.id,
    details: { id },
  });

  return apiSuccess({ id }, { message: "Lembur berhasil dihapus" });
});
