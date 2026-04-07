import { NextRequest, NextResponse } from "next/server";
import {
  LeaveRepository,
  MobileLeaveRequestService,
} from "@/modules/attendance";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";

const repo = new LeaveRepository();
const mobileLeaveRequestService = new MobileLeaveRequestService();

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const userId = payload.id as string;
    const tenantId = payload.tenantId as string;

    const leaves = await repo.findAll({ userId, tenantId });
    return NextResponse.json({ success: true, data: leaves });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const tenantId = payload.tenantId as string;
    const userId = payload.id as string;

    if (!userId) {
      return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    const body = await request.json();
    const { type, startDate, endDate, reason } = body;

    if (!type || !startDate || !endDate || !reason) {
      return apiError(
        "Field wajib tidak lengkap",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const requestData = await mobileLeaveRequestService.createLeaveRequest({
      userId,
      tenantId,
      type,
      startDate,
      endDate,
      reason,
      photos: body.photos,
      replacementDate: body.replacementDate,
    });

    if (requestData instanceof NextResponse) {
      return requestData;
    }

    return NextResponse.json(
      { success: true, data: requestData },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Leave request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}
