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
  // For assign action
  userId: z.uuid().optional(),
  componentId: z.uuid().optional(),
  amount: z.number().optional(),
  notes: z.string().max(500).optional(),
  // For create action
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

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen gaji",
    );
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") as SalaryComponentTypeValue | undefined;
  const userId = searchParams.get("userId");

  const { components, userComponents } = await componentService.getComponents(
    type,
    userId ?? undefined,
  );

  return apiSuccess({ components, userComponents });
});

export const POST = createHandler(
  {
    auth: true,
    schema: createComponentSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat komponen gaji",
      );
    }

    const {
      action,
      userId,
      componentId,
      amount,
      notes,
      name,
      type,
      rateType,
      defaultAmount,
      description,
      sortOrder,
    } = ctx.validated;

    if (action === "assign") {
      if (!userId || !componentId || amount === undefined) {
        return apiError(
          "userId, componentId, dan amount wajib diisi",
          ErrorCodes.MISSING_FIELD,
          { status: 400 },
        );
      }

      const userComponent = await componentService.assignComponent(
        userId,
        componentId,
        amount,
        notes,
      );
      return apiSuccess(
        { userComponent },
        { message: "Komponen berhasil ditambahkan ke user" },
      );
    } else {
      if (!name || !type) {
        return apiError("name dan type wajib diisi", ErrorCodes.MISSING_FIELD, {
          status: 400,
        });
      }

      // Check if component with same name already exists
      const existingComponent = await componentService.findByName(name);

      let component;
      if (existingComponent) {
        const reqRateType = rateType || "FIXED";
        if (existingComponent.type !== type) {
          return ApiErrors.conflict(
            `Komponen "${name}" sudah ada dengan tipe berbeda (${existingComponent.type})`,
          );
        }
        if (existingComponent.rateType !== reqRateType) {
          return ApiErrors.conflict(
            `Komponen "${name}" sudah ada dengan tipe rate berbeda (${existingComponent.rateType})`,
          );
        }
        component = existingComponent;
      } else {
        component = await componentService.createComponent({
          name,
          type,
          rateType: rateType || "FIXED",
          defaultAmount: defaultAmount ?? null,
          description: description ?? null,
          sortOrder: sortOrder || 0,
        });
      }

      return apiSuccess(
        { component },
        { status: 201, message: "Komponen berhasil dibuat" },
      );
    }
  },
);

export const PUT = createHandler(
  {
    auth: true,
    schema: updateComponentSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah komponen gaji",
      );
    }

    const {
      id,
      name,
      type,
      rateType,
      defaultAmount,
      description,
      sortOrder,
      isActive,
    } = ctx.validated;
    const component = await componentService.updateComponent(id, {
      ...(name ? { name } : {}),
      ...(type ? { type } : {}),
      ...(rateType ? { rateType } : {}),
      ...(defaultAmount !== undefined ? { defaultAmount } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    });

    return apiSuccess(
      { component },
      { message: "Komponen berhasil diperbarui" },
    );
  },
);

export const DELETE = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus komponen gaji",
    );
  }

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const userId = searchParams.get("userId");
  const componentId = searchParams.get("componentId");

  if (userId && componentId) {
    // Remove component from user
    await componentService.removeUserComponent(userId, componentId);
    return apiSuccess(null, { message: "Komponen berhasil dihapus dari user" });
  } else if (id) {
    // Delete component
    await componentService.deleteComponent(id);
    return apiSuccess(null, { message: "Komponen berhasil dihapus" });
  } else {
    return apiError(
      "id atau (userId + componentId) wajib diisi",
      ErrorCodes.MISSING_FIELD,
      { status: 400 },
    );
  }
});
