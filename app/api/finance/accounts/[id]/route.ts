import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { TREASURY_ACCOUNT_UPDATE_PERMISSIONS } from "@/lib/financial-write-permissions";
import { FinanceService, InvalidChartOfAccountError } from "@/modules/finance";

/**
 * Ubah akun kas/bank.
 *
 * Kolom yang paling penting di sini adalah `coaId`: handler jurnal menurunkan
 * sisi kredit dari tautan itu, jadi selama akun kas belum tertaut COA, tidak
 * ada jurnal otomatis yang terbentuk dan laporan arus kas tetap kosong.
 * Sebelumnya kolom tersebut ada di skema tetapi tidak bisa diisi dari mana pun.
 */
const updateAccountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi").optional(),
  type: z.enum(["BANK", "CASH", "EWALLET", "OTHER"]).optional(),
  accountNumber: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  coaId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = createHandler(
  {
    auth: true,
    permissions: TREASURY_ACCOUNT_UPDATE_PERMISSIONS,
    schema: updateAccountSchema,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const changes = ctx.validated;

    if (Object.keys(changes).length === 0) {
      return ApiErrors.badRequest("Tidak ada perubahan yang dikirim");
    }

    try {
      const account = await new FinanceService().updateAccount(
        id,
        ctx.session!.user.tenantId ?? null,
        changes,
      );
      return apiSuccess(account, { message: "Akun berhasil diperbarui" });
    } catch (error) {
      if (error instanceof InvalidChartOfAccountError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
