import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  announcementService,
  AnnouncementServiceError,
} from "@/modules/notification";

/** Mark one announcement as read for the authenticated user. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await announcementService.markAnnouncementAsRead(
      id,
      { userId: session.user.id },
      body.portal,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AnnouncementServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logger.error("Mark announcement read error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Get read statistics for one announcement. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;
    const result = await announcementService.getAnnouncementReadStats(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AnnouncementServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logger.error("Get announcement read stats error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
