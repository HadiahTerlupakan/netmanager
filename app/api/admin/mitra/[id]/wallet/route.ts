import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraWalletService } from "@/modules/mitra";
import { ensureMitraInScope } from "@/lib/api/guards";
import { walletAdjustmentSchema } from "@/lib/validations/mitra";

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const parsed = pageQuerySchema.safeParse(ctx.query);
    const page = parsed.success ? parsed.data.page : 1;

    const walletService = getMitraWalletService();
    const [balanceResult, transactionsResult] = await Promise.all([
      walletService.getBalance(id, user.tenantId),
      walletService.getTransactions(id, user.tenantId, page),
    ]);

    if (!balanceResult.success) {
      return ApiErrors.notFound(balanceResult.error);
    }

    return apiSuccess({
      balance: balanceResult.data,
      transactions: transactionsResult.success
        ? transactionsResult.data
        : { transactions: [], total: 0 },
    });
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["mitra:update"],
    schema: walletAdjustmentSchema,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const result = await getMitraWalletService().addAdjustment(
      id,
      ctx.validated.amount,
      ctx.validated.description,
      user.id,
      user.tenantId,
    );

    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    return apiSuccess(undefined);
  },
);
