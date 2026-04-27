import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { announcementService } from "@/modules/notification";

/** Update one announcement by id. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;
    const body = await request.json();
    const announcement = await announcementService.updateAnnouncement(id, body);
    return NextResponse.json(announcement);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Delete one announcement by id. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;
    const result = await announcementService.deleteAnnouncement(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
