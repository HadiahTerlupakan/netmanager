import { NextRequest, NextResponse } from "next/server";
import type { Prisma, TargetAudience } from "@prisma/client";
import { prisma } from "@/modules/database";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";

type MobileAnnouncementPortal = "customer" | "employee" | "admin";

const PORTAL_TARGETS: Record<MobileAnnouncementPortal, TargetAudience[]> = {
  customer: ["ALL", "CUSTOMER"],
  employee: ["ALL", "EMPLOYEE"],
  admin: ["ALL", "ADMIN"],
};

function resolvePortal(
  request: NextRequest,
  role?: string | null,
): MobileAnnouncementPortal {
  const portal = request.nextUrl.searchParams.get("portal");

  if (portal === "customer" || portal === "employee" || portal === "admin") {
    return portal;
  }

  const normalizedRole = role?.toUpperCase() ?? "";
  if (normalizedRole.includes("CUSTOMER")) {
    return "customer";
  }

  if (normalizedRole.includes("ADMIN")) {
    return "admin";
  }

  return "employee";
}

function buildAnnouncementWhere(
  tenantId: string | null | undefined,
  portal: MobileAnnouncementPortal,
  now: Date,
): Prisma.AnnouncementWhereInput {
  const targets = PORTAL_TARGETS[portal].slice();

  return {
    target: { in: targets },
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
    ...(tenantId ? { tenantId } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.userId ?? authResult.sub;
    const tenantId =
      authResult.tenantId ??
      (authResult as { tenant?: string | null }).tenant ??
      null;

    if (!userId) {
      return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    const portal = resolvePortal(request, authResult.role);
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: buildAnnouncementWhere(tenantId, portal, now),
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      announcements.map((announcement) => ({
        ...announcement,
        createdAt: announcement.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("Mobile announcement listing error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
