import { NextRequest, NextResponse } from "next/server";
import { getTenantSettingsService } from "@/modules/attendance";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const settingsService = getTenantSettingsService();

/**
 * GET /api/admin/attendance/settings
 * Get auto-reject settings untuk tenant.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await settingsService.getAutoRejectSettings(
      session.user.tenantId,
    );

    if (!settings) {
      // Return default settings jika belum ada
      return NextResponse.json({
        success: true,
        data: {
          autoRejectInsufficientQuota: true,
          autoRejectBackdate: true,
          autoRejectOverlap: true,
          autoRejectTooLong: true,
          autoRejectSakitNoDocument: true,
          autoRejectCutiNoAdvance: true,
          autoRejectTukarLiburNoDate: true,
          autoRejectBlackoutPeriod: true,
          maxDaysPerRequest: 14,
          minAdvanceNoticeDays: 3,
          sakitDocumentRequiredDays: 2,
          blackoutPeriods: [],
          enableTimelineAutoReject: true,
          mendadakDeadlineHours: 8,
          mendadakReminder1Hours: 4,
          mendadakReminder2Hours: 6,
          normalDeadlineDays: 1,
          normalReminder1Days: 3,
          normalReminder2Days: 2,
          advanceDeadlineDays: 1,
          advanceReminder1Days: 7,
          advanceReminder2Days: 3,
          advanceReminder3Days: 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/attendance/settings
 * Update auto-reject settings untuk tenant.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const updatedSettings = await settingsService.updateAutoRejectSettings(
      session.user.tenantId,
      body,
    );

    return NextResponse.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
