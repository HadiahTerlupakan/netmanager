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
  SUPPLIER_STATUSES,
  type SupplierStatus,
  type CreateSupplierInput,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | null): SupplierStatus | undefined {
  if (!raw) return undefined;
  return (SUPPLIER_STATUSES as readonly string[]).includes(raw)
    ? (raw as SupplierStatus)
    : undefined;
}

/**
 * Konversi field tanggal ISO string → Date untuk service.
 * Cast `status` & `defaultPphCategory` dari string Zod-enum ke literal union
 * domain (Zod v4 type inference-nya melebar ke `string`).
 */
function toServiceInput(data: CreateSupplierInput, tenantId: string | null) {
  const { contractExpiresAt, status, defaultPphCategory, ...rest } = data;
  return {
    ...rest,
    status: status as SupplierStatus | undefined,
    defaultPphCategory: defaultPphCategory as
      | "jasa"
      | "sewa"
      | "sewa_tanah"
      | null
      | undefined,
    contractExpiresAt: contractExpiresAt ? new Date(contractExpiresAt) : null,
    tenantId,
  };
}

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
    status: url.searchParams.get("status") ?? undefined,
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
    status: parseStatus(queryParse.data.status ?? null),
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
    const supplier = await getSupplierService().create(
      toServiceInput(validation.data as CreateSupplierInput, tenantId),
    );
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
