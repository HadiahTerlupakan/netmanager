import { revalidatePath } from "next/cache";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  PelangganAdminMutationError,
  PelangganAdminMutationService,
} from "@/modules/pelanggan";

const pelangganAdminMutationService = new PelangganAdminMutationService();

/**
 * Membatalkan perubahan paket yang dijadwalkan (pending package change).
 * Menghapus pendingPackageId dan pendingPackageApplyAt dari record pelanggan.
 */
export const POST = createHandler(
  { auth: true, permissions: ["pelanggan:update"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const session = ctx.session!;

    try {
      const result = await pelangganAdminMutationService.cancelPendingPackage({
        id,
        session: session as never,
      });

      if (!result.cancelled) {
        return ApiErrors.badRequest(
          "reason" in result
            ? result.reason
            : "Tidak ada perubahan paket yang dijadwalkan",
        );
      }

      revalidatePath(`/admin/pelanggan/ppp/${id}`);
      ctx.validated = { id, action: "CANCEL_PENDING_PACKAGE" };

      return apiSuccess({ cancelled: true });
    } catch (error) {
      if (error instanceof PelangganAdminMutationError) {
        if (error.code === "NOT_FOUND") return ApiErrors.notFound("Pelanggan");
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }
  },
);
