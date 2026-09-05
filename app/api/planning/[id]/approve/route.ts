import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningApprovalService,
  approvePlanningSchema,
} from "@/modules/planning";

/**
 * POST /api/planning/[id]/approve
 * Approve planning (level 1 atau level 2).
 *
 * Tanpa blok catch penerjemah: service melempar `AppError` domain yang sudah
 * membawa status code sendiri. Pola lama mencocokkan `err.message` dengan
 * string, sehingga pelanggaran segregation of duties — kontrol paling penting
 * di modul ini — tidak cocok dengan pola mana pun dan dilaporkan ke penyetuju
 * sebagai "Terjadi kesalahan pada server".
 *
 * Activity log ditulis di service, bukan di sini: sebelumnya keduanya menulis
 * dan setiap persetujuan menghasilkan dua entri aktivitas.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:approve"],
    schema: approvePlanningSchema,
  },
  async (req, ctx) => {
    const result = await planningApprovalService.approve(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
      ctx.validated.approvalNotes,
    );

    return apiSuccess(result, { message: "Planning berhasil disetujui" });
  },
);
