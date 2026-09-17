import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  ExpenseCategoryRouteService,
  isRouteServiceError,
} from "@/modules/finance";

export const dynamic = "force-dynamic";

const expenseCategoryRouteService = new ExpenseCategoryRouteService();

const updateCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z
    .string()
    .refine(
      (val) => ["CAPEX", "OPEX"].includes(val),
      "Tipe kategori tidak valid",
    ),
  parentId: z.string().optional().nullable(),
});

export const PUT = createHandler(
  {
    auth: true,
    schema: updateCategorySchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper || (await hasPermission("expense:update"));

    if (!hasAccess) {
      return ApiErrors.forbidden("Akses ditolak.");
    }

    const { name, type, parentId } = ctx.validated;

    // Prevent circular dependency (parent cannot be itself)
    if (parentId === id) {
      return ApiErrors.badRequest(
        "Kategori tidak bisa menjadi induk bagi dirinya sendiri",
      );
    }

    const category = await expenseCategoryRouteService.updateCategory({
      id,
      name,
      type,
      parentId: parentId || null,
      userId: user.id,
    });

    return apiSuccess(category);
  },
);

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!id) return ApiErrors.badRequest("ID kategori wajib diisi");

  // Check permissions
  const isSuper = isSuperAdmin(user);
  const hasAccess = isSuper || (await hasPermission("expense:delete"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:delete",
    );
  }

  try {
    await expenseCategoryRouteService.deleteCategory(id, user.id);
    return apiSuccess({ message: "Kategori pengeluaran berhasil dihapus" });
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }

    if (isRouteServiceError(error) && error.status === 400) {
      return ApiErrors.badRequest(error.message);
    }

    throw error;
  }
});
