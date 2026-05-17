import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  resolveDeadLetter,
  DeadLetterNotFoundError,
  DeadLetterAccessDeniedError,
  DeadLetterAlreadyResolvedError,
} from "@/modules/notification";

/**
 * POST /api/admin/notifications/dead-letter/[id]/resolve
 * Tandai DLQ entry sebagai resolved tanpa melakukan retry.
 */
export const POST = createHandler(
  { auth: true, permissions: ["notifications:manage"] },
  async (_req, ctx) => {
    const id = ctx.params.id as string;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId ?? null;

    try {
      const result = await resolveDeadLetter({ id, isSuperAdmin, tenantId });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof DeadLetterNotFoundError) {
        return ApiErrors.notFound(error.message);
      }
      if (error instanceof DeadLetterAccessDeniedError) {
        return ApiErrors.forbidden(error.message);
      }
      if (error instanceof DeadLetterAlreadyResolvedError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
