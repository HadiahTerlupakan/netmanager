import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getSupplierService,
  createSupplierSchema,
  supplierListQuerySchema,
  toSupplierDTO,
  SupplierCodeAlreadyExistsError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/suppliers - List suppliers (paginated, search-able)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("supplier:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data supplier",
    );
  }

  const url = new URL(req.url);
  const queryParse = supplierListQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!queryParse.success) {
    return ApiErrors.badRequest(
      queryParse.error.issues.map((i) => i.message).join(", "),
    );
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  const result = await getSupplierService().list({
    tenantId,
    search: queryParse.data.search,
    page: queryParse.data.page,
    limit: queryParse.data.limit,
  });

  return apiSuccess({
    items: result.items.map(toSupplierDTO),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/**
 * POST /api/admin/procurement/suppliers - Create new supplier
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("supplier:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah supplier",
    );
  }

  const validation = await validateRequestBody(req, createSupplierSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  try {
    const data = validation.data as {
      code: string;
      name: string;
      address?: string | null;
      contact?: string | null;
      email?: string | null;
      phone?: string | null;
      npwp?: string | null;
      defaultPphCategory?: "jasa" | "sewa" | "sewa_tanah" | null;
    };
    const supplier = await getSupplierService().create({
      ...data,
      tenantId,
    });
    return apiSuccess(toSupplierDTO(supplier), {
      message: "Supplier berhasil dibuat",
    });
  } catch (error) {
    if (error instanceof SupplierCodeAlreadyExistsError) {
      return ApiErrors.conflict(error.message);
    }
    throw error;
  }
});
