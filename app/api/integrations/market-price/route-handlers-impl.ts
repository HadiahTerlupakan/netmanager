import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { getMarketPriceRouteService } from "@/modules/integrations";

/** Handle market price lookup request. */
export const GET = createHandler({ auth: false }, async (req) => {
  try {
    const result = await getMarketPriceRouteService().getMarketPrice(
      req.nextUrl.searchParams.get("keyword"),
    );
    return NextResponse.json(result);
  } catch {
    return ApiErrors.internalError("Gagal mengambil data harga pasar");
  }
});
