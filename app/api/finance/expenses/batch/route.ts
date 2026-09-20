import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  beginExpenseMutation,
  buildExpensePayloadHash,
  completeExpenseMutation,
  ExpenseRouteService,
} from "@/modules/finance";
import * as z from "zod";

export const dynamic = "force-dynamic";

const expenseRouteService = new ExpenseRouteService();

const batchExpenseSchema = z.object({
  // Common fields shared by all items
  date: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  siteId: z.string().optional(),
  // Sumber dana. Tanpa ini pengeluaran tidak menghasilkan jurnal: event
  // EXPENSE_APPROVED hanya dikirim bila akun kas terisi.
  accountId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceFile: z.string().optional(),
  // Per-item fields
  items: z
    .array(
      z.object({
        amount: z
          .union([z.string(), z.number()])
          .transform((val) => BigInt(val)),
        category: z.string().min(1, "Kategori wajib diisi"),
        expenseCategoryId: z.string().optional(),
        depreciation: z
          .union([z.string(), z.number()])
          .optional()
          .transform((val) => (val ? BigInt(val) : BigInt(0))),
        usefulLife: z
          .union([z.string(), z.number()])
          .optional()
          .transform((val) => (val ? Number(val) : 0)),
        description: z.string().optional(),
        rabProjectId: z.string().optional(),
        rabItemId: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item diperlukan"),
});

export const POST = createHandler(
  {
    auth: true,
    schema: batchExpenseSchema,
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

    const { date, siteId, invoiceNumber, invoiceFile, items } = ctx.validated;

    const payloadHash = buildExpensePayloadHash(ctx.validated);
    const beginResult = beginExpenseMutation({
      action: "batch-create",
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

    let finalSiteId = siteId;
    if ((await hasPermission("expense:site_only")) && !isSuper) {
      try {
        finalSiteId = await expenseRouteService.resolveRestrictedSiteId(
          user.id,
        );
      } catch {
        return ApiErrors.forbidden(
          "User terikat site namun belum memiliki site",
        );
      }
    }

    const response = await expenseRouteService.createBatchExpenses(
      {
        date,
        siteId: finalSiteId,
        invoiceNumber,
        invoiceFile,
        items: items.map((item) => ({
          amount: item.amount,
          category: item.category,
          expenseCategoryId: item.expenseCategoryId,
          depreciation: item.depreciation,
          usefulLife: item.usefulLife,
          description: item.description,
          rabProjectId: item.rabProjectId,
          rabItemId: item.rabItemId,
        })),
      },
      userId,
    );

    completeExpenseMutation({
      action: "batch-create",
      key: idempotencyKey,
      userId,
      payloadHash,
      response,
    });

    return apiSuccess(response, {
      message: `${response.length} pengeluaran berhasil ditambahkan`,
    });
  },
);
