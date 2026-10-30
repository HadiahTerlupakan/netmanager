import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { announcementService } from "@/modules/notification";

/**
 * Pengumuman aktif untuk portal pelanggan.
 *
 * Popup portal dulu memanggil /api/announcements, yang hanya menerima sesi
 * staf, sehingga pelanggan selalu mendapat 401 dan pengumuman tidak pernah
 * tampil. Tenant dibatasi oleh konteks tenant dari cookie pelanggan.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const announcements = await announcementService.getAnnouncements({
      portal: "customer",
      activeOnly: true,
    });

    // Baris mentah membawa pembuat, tenant, dan jumlah pembaca; pelanggan
    // hanya perlu isi pengumumannya.
    return NextResponse.json(
      announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        isPinned: announcement.isPinned,
        target: announcement.target,
        startDate: announcement.startDate,
        endDate: announcement.endDate,
        createdAt: announcement.createdAt,
      })),
    );
  } catch (error) {
    logger.error("Customer announcements error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
