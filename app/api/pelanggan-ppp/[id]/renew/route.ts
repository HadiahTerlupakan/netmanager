import { revalidatePath } from "next/cache";
import { apiError, apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { CustomerRenewalError } from "@/modules/finance";
import {
  PelangganAdminMutationError,
  PelangganRenewalService,
  renewPelangganSchema,
} from "@/modules/pelanggan";

const pelangganRenewalService = new PelangganRenewalService();

/**
 * Perpanjang layanan pelanggan dari admin: pakai ulang tagihan yang masih
 * terbuka atau terbitkan tagihan siklus berjalan, lalu lunasi bila LUNAS.
 * Jatuh tempo baru dipasang worker INVOICE_PAID, bukan di request ini.
 */
export const POST = createHandler(
  {
    auth: true,
    permissionsAll: ["pelanggan:update", "payments:create"],
    schema: renewPelangganSchema,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;

    try {
      const result = await pelangganRenewalService.renew({
        id,
        session: session as never,
        userId: session.user.id,
        data: ctx.validated,
      });

      revalidatePath(`/admin/pelanggan/ppp/${id}`);
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof PelangganAdminMutationError) {
        if (error.code === "NOT_FOUND") return ApiErrors.notFound("Pelanggan");
        return ApiErrors.forbidden(error.message);
      }
      if (error instanceof CustomerRenewalError) {
        if (error.code === "NOT_FOUND") return ApiErrors.notFound("Pelanggan");
        if (error.code === "BUSY") return ApiErrors.conflict(error.message);
        return apiError(error.message, "VALIDATION_ERROR", { status: 400 });
      }
      throw error;
    }
  },
);
