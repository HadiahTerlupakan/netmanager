import { getSalaryUserService } from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";

const service = getSalaryUserService();

const assignComponentSchema = z.object({
  componentId: z.uuid({ error: "Component ID wajib diisi" }),
  amount: z.number().min(0).optional().default(0),
  notes: z.string().max(500).optional(),
});

// GET - Get user's salary components
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen gaji",
    );
  }

  const { id: userId } = ctx.params;
  const result = await service.getUserComponents(userId);

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

// POST - Assign component to user
export const POST = createHandler(
  {
    auth: true,
    schema: assignComponentSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah komponen gaji",
      );
    }

    const { id: userId } = ctx.params;
    const { componentId, amount, notes } = ctx.validated;

    const result = await service.assignComponent(userId, {
      componentId,
      amount,
      notes,
    });

    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(null, { message: "Komponen gaji berhasil ditambahkan" });
  },
);
