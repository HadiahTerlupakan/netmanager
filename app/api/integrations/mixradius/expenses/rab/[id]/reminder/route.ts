import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  RabApprovalReminderRouteService,
  isRouteServiceError,
} from "@/modules/finance";

const rabApprovalReminderRouteService = new RabApprovalReminderRouteService();

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    return ApiErrors.unauthorized("Unauthorized");
  }

  const rabId = ctx.params?.id;
  if (!rabId) {
    return ApiErrors.badRequest("ID RAB tidak ditemukan");
  }

  try {
    const result = await rabApprovalReminderRouteService.sendReminder(
      rabId,
      userId,
    );

    return apiSuccess(result, {
      message: `Reminder berhasil dikirim ke ${result.sentCount} approver`,
    });
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 403) {
      return ApiErrors.forbidden(error.message);
    }

    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }

    if (isRouteServiceError(error) && error.status === 400) {
      return ApiErrors.badRequest(error.message);
    }

    if (isRouteServiceError(error) && error.status === 409) {
      return ApiErrors.conflict(error.message);
    }

    throw error;
  }
});
