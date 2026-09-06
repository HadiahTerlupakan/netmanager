import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { AdminCustomerInvoiceRouteService } from "@/modules/pelanggan";

const adminCustomerInvoiceRouteService = new AdminCustomerInvoiceRouteService();

export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:read"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin;
    if (!tenantId && !isSuperAdmin) {
      return ApiErrors.forbidden("Akses ditolak: tenant tidak teridentifikasi");
    }
    const invoices = await adminCustomerInvoiceRouteService.getCustomerInvoices(
      {
        pelangganId: ctx.params.id,
        tenantId,
        isSuperAdmin,
      },
    );
    if (!invoices) {
      return ApiErrors.notFound("Pelanggan");
    }
    return apiSuccess(invoices);
  },
);
