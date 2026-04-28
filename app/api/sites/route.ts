import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getHybridUser } from "@/lib/hybrid-auth";
import { SiteAccessRouteService } from "@/modules/roles";

const siteAccessRouteService = new SiteAccessRouteService();

/** Ambil daftar site yang dapat diakses user. */
export async function GET(req: Request) {
  const user = (await getHybridUser(req)) as {
    role?: string;
    siteId?: string;
    id?: string;
  } | null;
  if (!user?.id) {
    return new NextResponse("Tidak terautentikasi", { status: 401 });
  }

  try {
    const resource = new URL(req.url).searchParams.get("resource") || undefined;
    const result = await siteAccessRouteService.getAccessibleSites(
      user,
      resource,
    );
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[SITES_GET]", error);
    return new NextResponse("Terjadi kesalahan server", { status: 500 });
  }
}
