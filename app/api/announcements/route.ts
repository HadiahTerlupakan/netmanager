import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import type { TargetAudience } from "@prisma/client";
import { announcementService } from "@/modules/notification";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { searchParams } = new URL(request.url);
    const announcements = await announcementService.getAnnouncements({
      target: searchParams.get("target") as TargetAudience | undefined,
      activeOnly: searchParams.get("active") === "true",
      portal: searchParams.get("portal"),
    });

    return NextResponse.json(announcements);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = await request.json();
    const announcement = await announcementService.createAnnouncement(
      body,
      session.user.id,
    );

    return NextResponse.json(announcement);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
