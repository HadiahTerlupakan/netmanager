import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import {
  AdminProfileRouteError,
  AdminProfileRouteService,
} from "@/modules/users";
import * as z from "zod";

const adminProfileRouteService = new AdminProfileRouteService();

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: z.string().min(6, "Password minimal 6 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password baru dan konfirmasi tidak cocok",
    path: ["confirmPassword"],
  });

// GET /api/admin/profile - Get current user profile
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  try {
    const profile = await adminProfileRouteService.getProfile(
      ctx.session!.user.id,
    );
    return apiSuccess(profile);
  } catch (error) {
    return handleProfileRouteError(error);
  }
});

// PATCH /api/admin/profile - Update current user profile
export const PATCH = createHandler(
  {
    auth: true,
    schema: updateProfileSchema,
  },
  async (_req, ctx) => {
    try {
      const updated = await adminProfileRouteService.updateProfile(
        ctx.session!.user.id,
        ctx.validated,
      );
      return apiSuccess(updated, { message: "Profil berhasil diperbarui" });
    } catch (error) {
      return handleProfileRouteError(error);
    }
  },
);

// POST /api/admin/profile - Change user password
export const POST = createHandler(
  {
    auth: true,
    schema: changePasswordSchema,
  },
  async (_req, ctx) => {
    try {
      const { currentPassword, newPassword } = ctx.validated;
      await adminProfileRouteService.changePassword(
        ctx.session!.user.id,
        currentPassword,
        newPassword,
      );
      return apiSuccess(null, { message: "Password berhasil diubah" });
    } catch (error) {
      return handleProfileRouteError(error);
    }
  },
);

function handleProfileRouteError(error: unknown) {
  if (!(error instanceof AdminProfileRouteError)) {
    throw error;
  }

  if (error.status === 404) {
    return ApiErrors.notFound("User");
  }

  if (error.status === 400) {
    return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  throw error;
}
