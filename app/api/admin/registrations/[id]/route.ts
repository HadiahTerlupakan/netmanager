import { hasPermission } from "@/lib/rbac";
import { RegistrationService } from "@/modules/registration";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

const registrationService = new RegistrationService();

/**
 * GET /api/admin/registrations/[id] - Get registration detail
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("registration:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat registrasi",
    );
  }

  const registration = await registrationService.getById(ctx.params.id);
  if (!registration) return ApiErrors.notFound("Registrasi");

  return apiSuccess(registration);
});

/**
 * PUT /api/admin/registrations/[id] - Update registration status
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("registration:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah registrasi",
    );
  }

  const body = await req.json();
  const { status, rejectionReason, notes } = body;

  if (!status) {
    return apiError("Status wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await registrationService.updateStatus(ctx.params.id, {
    status,
    rejectionReason,
    notes,
    verifiedBy: ctx.session?.user.email || "admin",
  });

  if (!result.success && result.statusCode === 404) {
    return ApiErrors.notFound("Registrasi");
  }

  if (!result.success && result.allowedStatuses) {
    return apiError(
      result.error || "Transisi status tidak valid",
      ErrorCodes.BUSINESS_LOGIC_ERROR,
      {
        status: result.statusCode || 400,
        details: { allowedStatuses: result.allowedStatuses },
      },
    );
  }

  if (!result.success) {
    return apiError(
      result.error || "Gagal mengubah status",
      ErrorCodes.VALIDATION_ERROR,
      {
        status: result.statusCode || 400,
      },
    );
  }

  return apiSuccess(result.data, {
    message: `Status berhasil diubah ke ${status}`,
  });
});

/**
 * DELETE /api/admin/registrations/[id] - Delete registration
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("registration:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus registrasi",
    );
  }

  const isDeleted = await registrationService.delete(ctx.params.id);
  if (!isDeleted) return ApiErrors.notFound("Registrasi");

  return apiSuccess(null, { message: "Registrasi berhasil dihapus" });
});
