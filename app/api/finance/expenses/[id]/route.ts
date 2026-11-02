import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createHandler,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api";
import {
  ExpenseRouteService,
  isRouteServiceError,
  resolveExpenseSiteScope,
  type RouteServiceError,
} from "@/modules/finance";
import * as z from "zod";

export const dynamic = "force-dynamic";

const expenseRouteService = new ExpenseRouteService();
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

const expenseSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
  date: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  category: z.string().min(1, "Category is required"),
  expenseCategoryId: z.string().optional(),
  description: z.string().optional(),
  siteId: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  rabProjectId: z.string().optional(),
  rabItemId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceFile: z.string().optional(),
});

export const PUT = createHandler(
  {
    auth: true,
    schema: expenseSchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!id)
      return apiError("ID tidak ditemukan", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });

    // Allow SUPER_ADMIN to bypass permission check
    const isSuper = isSuperAdmin(user);

    const hasAccess = isSuper || (await hasPermission("expense:update"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:update",
      );
    }

    const {
      amount,
      date,
      category,
      expenseCategoryId,
      description,
      siteId,
      categoryId,
      accountId,
      rabProjectId,
      rabItemId,
      invoiceNumber,
      invoiceFile,
    } = ctx.validated;

    try {
      const expense = await expenseRouteService.updateExpense(
        id,
        {
          amount,
          date,
          category,
          expenseCategoryId,
          description,
          siteId,
          categoryId,
          accountId,
          rabProjectId,
          rabItemId,
          invoiceNumber,
          invoiceFile,
        },
        resolveExpenseSiteScope(user, ctx.permissions),
      );

      return apiSuccess(expense, { message: "Expense berhasil diperbarui" });
    } catch (error) {
      if (isRouteServiceError(error)) return mapExpenseRouteError(error);
      throw error;
    }
  },
);

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!id)
    return apiError("ID tidak ditemukan", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });

  // Allow SUPER_ADMIN to bypass permission check
  const isSuper = isSuperAdmin(user);

  const hasAccess = isSuper || (await hasPermission("expense:delete"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:delete",
    );
  }

  try {
    const expense = await expenseRouteService.deleteExpense(
      id,
      resolveExpenseSiteScope(user, ctx.permissions),
    );
    return apiSuccess(expense, { message: "Expense berhasil dihapus" });
  } catch (error) {
    if (isRouteServiceError(error)) return mapExpenseRouteError(error);
    throw error;
  }
});

/** Terjemahkan galat lingkup/keberadaan pengeluaran ke respons HTTP. */
function mapExpenseRouteError(error: RouteServiceError) {
  if (error.status === HTTP_NOT_FOUND) {
    return apiError(error.message, ErrorCodes.NOT_FOUND, {
      status: HTTP_NOT_FOUND,
    });
  }
  if (error.status === HTTP_FORBIDDEN)
    return ApiErrors.forbidden(error.message);
  throw error;
}
