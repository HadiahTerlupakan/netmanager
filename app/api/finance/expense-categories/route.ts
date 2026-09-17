import { FinanceService } from "@/modules/finance";
import { isSuperAdmin } from "@/lib/auth";
import * as z from "zod";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { toEndOfDay } from "@/lib/utils/server-datetime";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") || undefined;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startDateParam && endDateParam) {
    const start = new Date(startDateParam);
    const end = new Date(endDateParam);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      startDate = start;
      endDate = toEndOfDay(end);
    }
  }

  const financeService = new FinanceService();
  const categories = await financeService.getExpenseCategories({
    type,
    startDate,
    endDate,
  });

  return apiSuccess(categories);
});

const createCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z
    .string()
    .refine(
      (val) => ["CAPEX", "OPEX"].includes(val),
      "Tipe kategori tidak valid (harus CAPEX atau OPEX)",
    ),
  parentId: z.string().optional().nullable(),
});

export const POST = createHandler(
  {
    auth: true,
    schema: createCategorySchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;

    // Basic permission check - creating config requires 'expense:create' permission or super admin
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper || (await hasPermission("expense:create"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:create",
      );
    }

    const financeService = new FinanceService();
    try {
      const category = await financeService.createExpenseCategory(
        ctx.validated,
      );

      await logger.logActivity({
        action: "CREATE",
        subject: "ExpenseCategory",
        details: { id: category.id, name: category.name, type: category.type },
        userId: user.id,
      });

      return apiSuccess(category);
    } catch (error: unknown) {
      return ApiErrors.badRequest(
        error instanceof Error ? error.message : "Gagal membuat kategori",
      );
    }
  },
);
