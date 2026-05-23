import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraWithdrawService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";
import { rejectWithdrawSchema } from "@/lib/validations/mitra";

const ACTIONS = ["approve", "reject", "complete"] as const;
type Action = (typeof ACTIONS)[number];

const isAction = (value: string | null): value is Action =>
  value !== null && (ACTIONS as readonly string[]).includes(value);

const optionalRejectSchema = rejectWithdrawSchema.partial();

export const POST = createHandler(
  {
    auth: true,
    permissions: ["withdrawals:update"],
    schema: optionalRejectSchema as unknown as z.ZodType<
      z.infer<typeof optionalRejectSchema>
    >,
  },
  async (request, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;
    const { searchParams } = new URL(request.url);
    const actionParam = searchParams.get("action");

    if (!isAction(actionParam)) {
      return ApiErrors.badRequest("Invalid action");
    }

    const { isRestricted, siteIds } = checkSiteRestriction(
      { user } as never,
      "withdrawals",
    );
    const tenantId = user.tenantId ?? undefined;
    if (isRestricted) {
      const inScope = await getMitraWithdrawService().isWithdrawInScope(
        id,
        siteIds,
        tenantId,
      );
      if (!inScope) {
        return ApiErrors.forbidden(
          "Anda tidak dapat memproses withdrawal untuk mitra di luar scope Anda",
        );
      }
    }

    const service = getMitraWithdrawService();
    let result;
    if (actionParam === "approve") {
      result = await service.approveWithdraw(id, user.id, tenantId);
    } else if (actionParam === "reject") {
      const reason = ctx.validated.reason || "Ditolak oleh admin";
      result = await service.rejectWithdraw(id, reason, user.id, tenantId);
    } else {
      result = await service.completeWithdraw(id, user.id, tenantId);
    }

    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    return apiSuccess(undefined);
  },
);
