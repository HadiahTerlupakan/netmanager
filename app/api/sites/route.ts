import { NextResponse } from "next/server";
import { getHybridUser } from "@/lib/hybrid-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getHybridUser(req) as { role?: string; siteId?: string } | null;

  if (!user) {
    return new NextResponse("Tidak terautentikasi", { status: 401 });
  }

  try {
    const where: { id?: string } = {};

    // Check for site restriction: NOT Super Admin AND has siteId assigned
    if (user.role !== 'SUPER_ADMIN' && user.siteId) {
        where.id = user.siteId;
    }

    const sites = await prisma.sites.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("[SITES_GET]", error);
    return new NextResponse("Terjadi kesalahan server", { status: 500 });
  }
}
