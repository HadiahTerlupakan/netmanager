import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { getNetworkAlertService } from "@/modules/network";
import {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
} from "@/lib/validations/network-performance";
import * as z from "zod";
import type { NetworkAlertCreateData } from "@/lib/validations/network-performance";

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;
  const queryParams = Object.fromEntries(searchParams.entries());

  const parsed = networkAlertQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid query parameters", {
      errors: z.flattenError(parsed.error),
    });
  }

  const networkAlertService = getNetworkAlertService();
  const result = await networkAlertService.getAlertList(parsed.data);

  return apiSuccess(result);
});

export const POST = createHandler(
  {
    auth: true,
    schema: networkAlertCreateSchema,
  },
  async (_req, ctx) => {
    const data = ctx.validated as NetworkAlertCreateData;
    const networkAlertService = getNetworkAlertService();

    try {
      const result = await networkAlertService.createAlert(data);

      logActivitySafe({
        action: "CREATE",
        subject: "Network Alert",
        userId: ctx.session!.user.id,
        details: {
          id: result.id,
          title: data.title,
          severity: data.severity,
          deviceId: data.deviceId,
        },
      });

      return apiSuccess(result, { status: 201 });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error as Error & { code?: string }).code === "P2021"
      ) {
        return ApiErrors.internalError(
          "Network alerts will be available after database migration",
        );
      }

      throw error;
    }
  },
);
