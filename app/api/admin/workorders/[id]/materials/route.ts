import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { adminWorkOrderRouteService } from "@/modules/work-order";
import * as z from "zod";

const addMaterialSchema = z.object({
  barangId: z.string().min(1, "Barang harus dipilih"),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  notes: z.string().optional(),
  gudangId: z.string().optional(),
});

/** POST /api/admin/workorders/{id}/materials */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("list:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah work order",
    );
  }

  const validation = addMaterialSchema.safeParse(await req.json());

  if (!validation.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(validation.error),
    });
  }

  const result = await adminWorkOrderRouteService.addMaterial({
    workOrderId: ctx.params.id,
    barangId: validation.data.barangId,
    quantity: validation.data.quantity,
    notes: validation.data.notes,
    gudangId: validation.data.gudangId,
    actor: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    if (result.code === "UNAUTHORIZED") {
      return ApiErrors.unauthorized();
    }

    return apiError(
      result.error || "Gagal menambahkan material",
      result.code === "ADD_MATERIAL_ERROR"
        ? ErrorCodes.VALIDATION_ERROR
        : ErrorCodes.INTERNAL_ERROR,
      { status: 400 },
    );
  }

  return apiSuccess(result.data, { message: "Material berhasil ditambahkan" });
});
