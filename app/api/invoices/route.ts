import { Prisma } from "@prisma/client";
import { invoiceSchema } from "@/lib/validations/invoice";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { createInvoiceForRoute, listInvoicesForRoute } from "@/modules/finance";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl;
  const user = ctx.session!.user;
  const result = await listInvoicesForRoute({
    filters: {
      status: searchParams.get("status"),
      pelangganId: searchParams.get("pelangganId"),
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      search: searchParams.get("search"),
    },
    user,
    isRestricted: await canOnlyAccessOwnSite(user),
  });

  return apiSuccess(result);
});

export const POST = createHandler(
  {
    auth: true,
    schema: invoiceSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;

    try {
      const result = await createInvoiceForRoute({
        input: ctx.validated,
        user,
        isRestricted: await canOnlyAccessOwnSite(user),
      });

      if (result.status === "not-found") {
        return ApiErrors.notFound("Pelanggan");
      }

      if (result.status === "forbidden-user-site") {
        return ApiErrors.forbidden("User tidak memiliki akses site");
      }

      if (result.status === "forbidden-customer-site") {
        return ApiErrors.forbidden("Pelanggan tidak berada di site anda");
      }

      return apiSuccess(result.data, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating invoice:", error);

      if (isPrismaErrorCode(error, "P2002")) {
        return ApiErrors.conflict("Nomor invoice sudah digunakan");
      }

      if (isPrismaErrorCode(error, "P2003")) {
        return ApiErrors.badRequest(
          "Pelanggan tidak ditemukan (Foreign Key Error)",
        );
      }

      return ApiErrors.internalError("Terjadi kesalahan server");
    }
  },
);

async function canOnlyAccessOwnSite(user: { role?: string | null }) {
  return (
    (await hasPermission("invoice:site_only")) && user.role !== "SUPER_ADMIN"
  );
}

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
