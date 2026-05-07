import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  MixRadiusConfigError,
  MixRadiusDismantleService,
} from "@/modules/integrations";
import { isRouteServiceError } from "@/modules/finance";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const mixRadiusDismantleService = new MixRadiusDismantleService();

/**
 * POST /api/integrations/mixradius/dismantle
 * Request dismantle (bongkar) for a MixRadius customer.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccessDismantle(
    user.id,
    isSuperAdmin(user),
  );

  if (!hasAccess) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const { customerId, reason, notes } = body;

  const missingFields: string[] = [];
  if (!customerId) missingFields.push("ID Pelanggan");
  if (!reason) missingFields.push("Alasan Bongkar");

  if (missingFields.length > 0) {
    return apiError(
      `Data berikut wajib diisi: ${missingFields.join(", ")}`,
      ErrorCodes.VALIDATION_ERROR,
      { details: { missingFields }, status: 400 },
    );
  }

  try {
    const workOrder = await mixRadiusDismantleService.createDismantleRequest({
      userId: user.id,
      customerId,
      reason,
      notes,
    });

    return apiSuccess(
      {
        data: workOrder,
        message: `Work Order ${workOrder.workOrderNumber} berhasil dibuat.`,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof MixRadiusConfigError) {
      return apiError(error.message, ErrorCodes.MIXRADIUS_CONFIG_ERROR, {
        status: 503,
        details: { isConfigError: true },
      });
    }

    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }

    throw error;
  }
});
