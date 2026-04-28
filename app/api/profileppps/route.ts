import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { checkSiteRestriction } from "@/modules/roles";
import { mapProfilePPPRouteError, ProfilePPPService } from "@/modules/network";

const profilePPPService = new ProfilePPPService();

/** Mendapatkan semua data Profile PPP. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    if (!(await hasPermission("profileppp:read"))) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const profilePPPs = await profilePPPService.listProfilePPPs({
      status: searchParams.get("status"),
      siteId: searchParams.get("siteId"),
      restriction: checkSiteRestriction(session, "profileppp"),
    });

    return NextResponse.json(profilePPPs);
  } catch (error: unknown) {
    logger.error("Error fetching profile PPPs:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}

/** Membuat Profile PPP baru. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    if (!(await hasPermission("profileppp:create"))) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const result = await profilePPPService.createProfilePPPFromRequest({
      session,
      sessionContext: {
        user: {
          id: session.user.id!,
          tenantId: session.user.tenantId ?? undefined,
        },
      },
      body: await req.json(),
    });

    if (!result.success) {
      return NextResponse.json(
        result.details
          ? { error: result.error, details: result.details }
          : { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.profilePPP, { status: 201 });
  } catch (error: unknown) {
    logger.error("Error creating profile PPP:", error);

    const routeError = mapProfilePPPRouteError(error);
    if (routeError) {
      return NextResponse.json(routeError.body, { status: routeError.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
