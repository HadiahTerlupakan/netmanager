import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { ProfilePPPService } from "@/modules/network";

const profilePPPService = new ProfilePPPService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;
    const profilePPP = await profilePPPService.getProfilePPPDetail(id);

    if (!profilePPP) {
      return NextResponse.json(
        { error: "Profile PPP tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(profilePPP);
  } catch (error: unknown) {
    logger.error("Error fetching profile PPP:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;
    const body = await req.json();

    const result = await profilePPPService.updateProfilePPPFromRequest({
      session,
      sessionContext: {
        user: {
          id: session.user.id!,
          tenantId: session.user.tenantId ?? undefined,
        },
      },
      id,
      body,
    });

    if (!result.success) {
      return NextResponse.json(
        result.details
          ? { error: result.error, details: result.details }
          : { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.profilePPP);
  } catch (error: unknown) {
    logger.error("Error updating profile PPP:", error);

    const routeError = profilePPPService.toProfilePPPRouteError(error);
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;
    const result = await profilePPPService.deleteProfilePPPFromRequest({
      session,
      id,
    });

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ message: result.message });
  } catch (error: unknown) {
    logger.error("Error deleting profile PPP:", error);

    const routeError = profilePPPService.toProfilePPPRouteError(error);
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
