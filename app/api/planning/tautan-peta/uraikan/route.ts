import { z } from "zod";

import { createHandler, apiSuccess } from "@/lib/api";
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
    return apiSuccess(await selesaikanTautanPendek(awal.url));
  },
);
