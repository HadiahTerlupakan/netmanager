import { createHandler, apiSuccess } from "@/lib/api";
import { OdpRouteService } from "@/modules/network";

export const dynamic = "force-dynamic";

const odpRouteService = new OdpRouteService();

/** Ambil daftar ODP untuk kebutuhan dropdown atau listing ringan. */
export const GET = createHandler({ auth: true }, async (req) => {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId") || undefined;
  const result = await odpRouteService.getOdps(siteId);
  return apiSuccess(result);
});
