import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { announcementService } from "@/modules/notification";

/** Mark one customer announcement as read. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { session } = authResult;
    const { id: announcementId } = await params;
    const body = await request.json().catch(() => ({}));
    const portal = body.portal || "customer";
    const result = await announcementService.markAnnouncementAsReadForCustomer(
      announcementId,
      { pelangganId: session.id },
      portal,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Customer mark announcement read error:", error);
    if (
      error instanceof Error &&
      error.message === "Pengumuman tidak ditemukan"
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
