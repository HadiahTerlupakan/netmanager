import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

const calculateSchema = z
  .object({
    periodStart: z.iso.date().transform((s) => new Date(s)),
    periodEnd: z.iso.date().transform((s) => new Date(s)),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Periode selesai harus setelah periode mulai",
    path: ["periodEnd"],
  });

/**
 * POST: Hitung bagi hasil investor per proyek RAB untuk periode. Laba diambil
 * dari capaian bulanan tiap proyek; proyek yang belum bisa dihitung
 * dikembalikan di `dilewati` beserta alasannya.
 */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const body = await req.json();
    const data = calculateSchema.parse(body);
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const service = getInvestorProfitShareService();
    const hasil = await service.calculateForPeriod(
      tenantId,
      data.periodStart,
      data.periodEnd,
    );

    return apiSuccess(hasil, { status: 201 });
  },
);
