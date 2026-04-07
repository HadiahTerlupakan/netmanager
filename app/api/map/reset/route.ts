import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getMappingAdminService } from "@/modules/map";
import * as z from "zod";

const service = getMappingAdminService();

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

/**
 * @swagger
 * /api/map/reset:
 *   delete:
 *     summary: Delete all mapping data (requires password verification)
 *     tags: [Map]
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["map:delete"],
    schema: resetSchema,
  },
  async (req, ctx) => {
    const { password } = ctx.validated;
    const session = ctx.session;

    if (!session?.user?.email) return ApiErrors.unauthorized();

    const isPasswordValid = await service.verifyResetPassword(
      session.user.email,
      password,
    );

    if (!isPasswordValid) {
      return ApiErrors.badRequest("Invalid password. Please try again.");
    }

    await service.resetAllMappingData();

    return apiSuccess({
      message: "All mapping data has been deleted successfully",
    });
  },
);
