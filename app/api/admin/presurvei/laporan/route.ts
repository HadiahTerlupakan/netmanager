import type { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  laporanPeriodeSchema,
  TargetService,
  toBarisLaporanDto,
} from "@/modules/presurvei";

const service = new TargetService();

/** GET /api/admin/presurvei/laporan — pencapaian sales pada satu periode. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_laporan:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const periode = laporanPeriodeSchema.parse({
      tahun: searchParams.get("tahun") ?? undefined,
      bulan: searchParams.get("bulan") ?? undefined,
    });

    const laporan = await service.laporanPencapaian(periode);

    return apiSuccess(laporan.map(toBarisLaporanDto));
  },
);
