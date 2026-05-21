import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getEmployeeProfileRepository,
  getPayrollComponentRepository,
} from "@/modules/salary";
import * as z from "zod";

const profileRepo = getEmployeeProfileRepository();
const componentRepo = getPayrollComponentRepository();

const assignComponentSchema = z.object({
  componentId: z.string().min(1),
  amount: z.number().nullable().optional(),
});

const removeComponentSchema = z.object({
  componentId: z.string().min(1),
});

/** GET /api/admin/salary/profiles/[userId]/components — Get employee's assigned components */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen karyawan",
    );
  }

  const { userId } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const profile = await profileRepo.findByUserId(userId, tenantId);
  if (!profile) {
    return ApiErrors.notFound("Profil payroll karyawan");
  }

  return apiSuccess({ components: profile.components });
});

/** POST /api/admin/salary/profiles/[userId]/components — Assign a component to employee */
export const POST = createHandler(
  { auth: true, schema: assignComponentSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah komponen karyawan",
      );
    }

    const { userId } = ctx.params;
    const tenantId = ctx.session!.user.tenantId!;
    const { componentId, amount } = ctx.validated;

    const profile = await profileRepo.findByUserId(userId, tenantId);
    if (!profile) {
      return ApiErrors.notFound("Profil payroll karyawan");
    }

    // Validate component exists
    const component = await componentRepo.findById(componentId, tenantId);
    if (!component) {
      return ApiErrors.notFound("Komponen payroll");
    }

    await profileRepo.assignComponent(userId, tenantId, {
      componentId: component.id,
      componentCode: component.code,
      componentName: component.name,
      category: component.category,
      calculationType: component.calculationType,
      amount: amount ?? component.defaultAmount,
      isActive: true,
    });

    // Return updated components
    const updated = await profileRepo.findByUserId(userId, tenantId);

    return apiSuccess(
      { components: updated!.components },
      { status: 201, message: "Komponen berhasil ditambahkan" },
    );
  },
);

/** DELETE /api/admin/salary/profiles/[userId]/components — Remove a component from employee */
export const DELETE = createHandler(
  { auth: true, schema: removeComponentSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah komponen karyawan",
      );
    }

    const { userId } = ctx.params;
    const tenantId = ctx.session!.user.tenantId!;
    const { componentId } = ctx.validated;

    const profile = await profileRepo.findByUserId(userId, tenantId);
    if (!profile) {
      return ApiErrors.notFound("Profil payroll karyawan");
    }

    await profileRepo.removeComponent(userId, tenantId, componentId);

    // Return updated components
    const updated = await profileRepo.findByUserId(userId, tenantId);

    return apiSuccess(
      { components: updated!.components },
      { message: "Komponen berhasil dihapus" },
    );
  },
);
