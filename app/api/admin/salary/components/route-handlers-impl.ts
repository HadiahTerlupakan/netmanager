import { getSalaryComponentService } from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import * as z from "zod";

const componentService = getSalaryComponentService();
const SALARY_COMPONENT_TYPES = ["EARNING", "DEDUCTION"] as const;
type SalaryComponentTypeValue = (typeof SALARY_COMPONENT_TYPES)[number];

const createComponentSchema = z.object({
  action: z.enum(["assign", "create"]).optional(),
  userId: z.uuid().optional(),
  componentId: z.uuid().optional(),
  amount: z.number().optional(),
  notes: z.string().max(500).optional(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(SALARY_COMPONENT_TYPES).optional(),
  rateType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  defaultAmount: z.number().optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
});

const updateComponentSchema = z.object({
  id: z.uuid({ error: "ID komponen wajib diisi" }),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(SALARY_COMPONENT_TYPES).optional(),
  rateType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  defaultAmount: z.number().optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/** Handle salary component list request. */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen gaji",
    );
  }

  const type = req.nextUrl.searchParams.get("type") as
    | SalaryComponentTypeValue
    | undefined;
  const userId = req.nextUrl.searchParams.get("userId") || undefined;
  const result = await componentService.getComponents(type, userId);
  return apiSuccess(result);
});

/** Handle salary component create or assign request. */
export const POST = createHandler(
  { auth: true, schema: createComponentSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat komponen gaji",
      );
    }

    const payload = ctx.validated;
    if (payload.action === "assign") {
      if (
        !payload.userId ||
        !payload.componentId ||
        payload.amount === undefined
      ) {
        return apiError(
          "userId, componentId, dan amount wajib diisi",
          ErrorCodes.MISSING_FIELD,
          { status: 400 },
        );
      }

      const userComponent = await componentService.assignComponent(
        payload.userId,
        payload.componentId,
        payload.amount,
        payload.notes,
      );
      return apiSuccess(
        { userComponent },
        { message: "Komponen berhasil ditambahkan ke user" },
      );
    }

    if (!payload.name || !payload.type) {
      return apiError("name dan type wajib diisi", ErrorCodes.MISSING_FIELD, {
        status: 400,
      });
    }

    const existingComponent = await componentService.findByName(payload.name);
    if (existingComponent) {
      const reqRateType = payload.rateType || "FIXED";
      if (existingComponent.type !== payload.type) {
        return ApiErrors.conflict(
          `Komponen "${payload.name}" sudah ada dengan tipe berbeda (${existingComponent.type})`,
        );
      }
      if (existingComponent.rateType !== reqRateType) {
        return ApiErrors.conflict(
          `Komponen "${payload.name}" sudah ada dengan tipe rate berbeda (${existingComponent.rateType})`,
        );
      }
      return apiSuccess(
        { component: existingComponent },
        { status: 201, message: "Komponen berhasil dibuat" },
      );
    }

    const component = await componentService.createComponent({
      name: payload.name,
      type: payload.type,
      rateType: payload.rateType || "FIXED",
      defaultAmount: payload.defaultAmount ?? null,
      description: payload.description ?? null,
      sortOrder: payload.sortOrder || 0,
    });
    return apiSuccess(
      { component },
      { status: 201, message: "Komponen berhasil dibuat" },
    );
  },
);

/** Handle salary component update request. */
export const PUT = createHandler(
  { auth: true, schema: updateComponentSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah komponen gaji",
      );
    }

    const payload = ctx.validated;
    const component = await componentService.updateComponent(payload.id, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.type ? { type: payload.type } : {}),
      ...(payload.rateType ? { rateType: payload.rateType } : {}),
      ...(payload.defaultAmount !== undefined
        ? { defaultAmount: payload.defaultAmount }
        : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.sortOrder !== undefined
        ? { sortOrder: payload.sortOrder }
        : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    });

    return apiSuccess(
      { component },
      { message: "Komponen berhasil diperbarui" },
    );
  },
);

/** Handle salary component delete request. */
export const DELETE = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus komponen gaji",
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("userId");
  const componentId = req.nextUrl.searchParams.get("componentId");

  if (userId && componentId) {
    await componentService.removeUserComponent(userId, componentId);
    return apiSuccess(null, { message: "Komponen berhasil dihapus dari user" });
  }
  if (id) {
    await componentService.deleteComponent(id);
    return apiSuccess(null, { message: "Komponen berhasil dihapus" });
  }

  return apiError(
    "id atau (userId + componentId) wajib diisi",
    ErrorCodes.MISSING_FIELD,
    { status: 400 },
  );
});
