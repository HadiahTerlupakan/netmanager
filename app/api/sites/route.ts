import { NextResponse } from "next/server";
import { getHybridUser } from "@/lib/hybrid-auth";
import { prisma } from "@/modules/database";

export async function GET(req: Request) {
  const user = await getHybridUser(req) as { role?: string; siteId?: string; id?: string } | null;

  if (!user || !user.id) {
    return new NextResponse("Tidak terautentikasi", { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');

    const where: { id?: string | { in: string[] } } = {};

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: {
          include: { permission: true }
        },
        userSites: true
      }
    });

    const isSuperAdmin = dbUser?.role?.isSuperAdmin || dbUser?.role?.name === 'SUPER_ADMIN' || dbUser?.role?.name === 'Super Admin';
    let isSiteOnly = false;

    if (!isSuperAdmin) {
      if (resource) {
        const permissions = dbUser?.role?.permission.map((p: { resource: string, action: string }) => `${p.resource}:${p.action}`) || [];
        isSiteOnly = permissions.includes(`${resource}:site_only`);
      } else {
        isSiteOnly = dbUser?.role?.isRestricted ?? false;
      }
    }

    // Check for site restriction: NOT Super Admin AND has site limits
    if (isSiteOnly) {
      const siteIds = dbUser?.userSites.map((us: { siteId: string }) => us.siteId) || [];
      if (dbUser?.siteId && !siteIds.includes(dbUser.siteId)) {
        siteIds.push(dbUser.siteId);
      }

      if (siteIds.length > 0) {
        where.id = { in: siteIds };
      } else if (dbUser?.siteId) {
        where.id = dbUser.siteId;
      }
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
