import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMarketPriceRouteService } from "@/modules/integrations";

export const GET = createHandler({ auth: true }, async (req) => {
  try {
    const result = await getMarketPriceRouteService().getMarketPrice(
      req.nextUrl.searchParams.get("keyword"),
    );
    return apiSuccess(result);
  } catch {
    return ApiErrors.internalError("Gagal mengambil data harga pasar");
  }
});
