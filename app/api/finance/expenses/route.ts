import {
  FinanceService,
  isRouteServiceError,
  resolveExpenseCreateSiteId,
  resolveExpenseSiteScope,
} from "@/modules/finance";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logAuditActivity } from "@/lib/middleware/request-logger";
import {
  beginExpenseMutation,
  buildExpensePayloadHash,
  completeExpenseMutation,
} from "@/modules/finance";
import * as z from "zod";

export const dynamic = "force-dynamic";

const expenseSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
  depreciation: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val ? BigInt(val) : BigInt(0))),
  usefulLife: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val ? Number(val) : 0)),
  date: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  category: z.string().min(1, "Kategori wajib diisi"),
  expenseCategoryId: z.string().optional(),
  description: z.string().optional(),
  siteId: z.string().optional(),
  rabProjectId: z.string().optional(),
  rabItemId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceFile: z.string().optional(),
  accountId: z.string().optional(),
});

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  const hasAccess = isSuper || (await hasPermission("expense:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read",
    );
  }

  const { searchParams } = req.nextUrl;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const category = searchParams.get("category");
  const expenseCategoryId = searchParams.get("expenseCategoryId");
  const scope = searchParams.get("scope");

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startDateParam && endDateParam) {
    startDate = startDateParam.includes("T")
      ? new Date(startDateParam)
      : new Date(`${startDateParam}T00:00:00`);
    endDate = endDateParam.includes("T")
      ? new Date(endDateParam)
      : new Date(`${endDateParam}T23:59:59.999`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return ApiErrors.badRequest("Format tanggal tidak valid");
    }
  }

  const financeService = new FinanceService();
  const expenses = await financeService.getExpenses({
    startDate,
    endDate,
    siteId,
    category,
    expenseCategoryId,
    scope,
    siteScope: resolveExpenseSiteScope(user, ctx.permissions),
  });

  return apiSuccess(expenses);
});

export const POST = createHandler(
  {
    auth: true,
    schema: expenseSchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const userId = user.id;
    const isSuper = isSuperAdmin(user);

    const hasAccess = isSuper || (await hasPermission("expense:create"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:create",
      );
    }

    const idempotencyKey = req.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) {
      return ApiErrors.badRequest("Header x-idempotency-key wajib diisi");
    }

    let finalSiteId: string | undefined;
    try {
      finalSiteId = resolveExpenseCreateSiteId(
        resolveExpenseSiteScope(user, ctx.permissions),
        ctx.validated.siteId,
      );
    } catch (error) {
      if (isRouteServiceError(error)) return ApiErrors.forbidden(error.message);
      throw error;
    }

    const payloadHash = buildExpensePayloadHash(ctx.validated);
    const beginResult = beginExpenseMutation({
      action: "create",
      key: idempotencyKey,
      userId,
      payloadHash,
    });

    if (beginResult.status === "replay") {
      return apiSuccess(beginResult.response);
    }

    if (beginResult.status === "hash-mismatch") {
      return ApiErrors.conflict(
        "Idempotency key sudah dipakai untuk payload berbeda",
      );
    }

    if (beginResult.status === "in-progress") {
      return ApiErrors.conflict("Permintaan serupa sedang diproses");
    }

    const financeService = new FinanceService();
    const response = await financeService.createExpense(
      {
        ...ctx.validated,
        siteId: finalSiteId,
      } as Parameters<typeof financeService.createExpense>[0],
      userId,
    );

    completeExpenseMutation({
      action: "create",
      key: idempotencyKey,
      userId,
      payloadHash,
      response,
    });

    await logAuditActivity(
      req,
      { status: 201 } as unknown as import("next/server").NextResponse,
      userId,
      user.tenantId,
      ctx.validated,
    );

    return apiSuccess(response, { status: 201 });
  },
);
