import { NextResponse } from "next/server";
import { getHybridUser } from "@/lib/hybrid-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getHybridUser(req);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const where: any = {};
    
    // Type assertion to access custom properties including siteId
    const currentUser = user as any;
    
    // Check for site restriction: NOT Super Admin AND has siteId assigned
    if (currentUser.role !== 'SUPER_ADMIN' && currentUser.siteId) {
        where.id = currentUser.siteId;
    }

    const sites = await prisma.sites.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("[SITES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
