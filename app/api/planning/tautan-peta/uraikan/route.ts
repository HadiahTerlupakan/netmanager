import { z } from "zod";

import { createHandler, apiSuccess } from "@/lib/api";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { uraikanTautanPeta } from "@/lib/geo/tautan-peta";
import { selesaikanTautanPendek } from "@/lib/geo/tautan-peta-pendek";

const BATAS_PANJANG_TAUTAN = 2048;

const skemaUraiTautan = z.object({
  tautan: z
    .string()
    .min(1, "Tautan wajib diisi")
    .max(BATAS_PANJANG_TAUTAN, "Tautan terlalu panjang"),
});

/**
 * POST /api/planning/tautan-peta/uraikan
 *
 * Mengubah tautan Google Maps menjadi koordinat. Tautan panjang diurai tanpa
 * jaringan; hanya tautan pendek yang memicu permintaan keluar, dengan penjaga
 * di `lib/geo/tautan-peta-pendek.ts`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: skemaUraiTautan,
  },
  async (_req, ctx) => {
    const awal = uraikanTautanPeta(ctx.validated.tautan);
    if (awal.status !== "butuh_resolusi") {
      return apiSuccess(awal);
    }

    // Hanya jalur yang mengirim permintaan keluar yang dibatasi, per pengguna.
    const kunciBatas = `tautan-peta-pendek:${ctx.session?.user.id ?? "anonim"}`;
    if (!rateLimit(kunciBatas, RATE_LIMITS.resolveMapShortLink)) {
      return apiError(
        "Terlalu banyak permintaan. Coba lagi dalam 1 menit.",
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        { status: 429 },
      );
    }
    return apiSuccess(await selesaikanTautanPendek(awal.url));
  },
);
