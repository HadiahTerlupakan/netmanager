import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { EmployeeLeaveQueryService } from "@/modules/attendance";
import { MobileLeaveRequestService } from "@/modules/attendance";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  idempotencyService,
  resolveIdempotencyKey,
} from "@/lib/api/idempotency";

const employeeLeaveQueryService = new EmployeeLeaveQueryService();
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

    const leaves = await employeeLeaveQueryService.getRequests({
      userId,
      tenantId,
    });
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

    // Idempotency: SyncService replay leave request yang gagal mid-network
    // bisa create duplicate cuti — payroll dihitung 2x. Header
    // `Idempotency-Key` ensures replay return cached response.
    const requestId = resolveIdempotencyKey(
      request.headers.get("Idempotency-Key"),
      body?.requestId,
    );

    const outcome = await idempotencyService.execute({
      scope: "leave:create",
      userId,
      requestId,
      payload: body,
      handler: () =>
        mobileLeaveRequestService.createLeaveRequest({
          userId,
          tenantId,
          type,
          startDate,
          endDate,
          reason,
          photos: body.photos,
          replacementDate: body.replacementDate,
        }),
    });

    switch (outcome.kind) {
      case "fresh":
      case "no-key": {
        const data = outcome.response;
        if (data && typeof data === "object" && "error" in data) {
          const err = data as { error: string; code: string; status: number };
          return NextResponse.json(
            { error: err.error, code: err.code },
            { status: err.status },
          );
        }
        return NextResponse.json({ success: true, data }, { status: 201 });
      }
      case "replay":
        return NextResponse.json(
          { success: true, data: outcome.response },
          { status: 201, headers: { "X-Idempotent-Replay": "true" } },
        );
      case "in-progress":
        return apiError(
          "Permintaan masih diproses, tunggu sebentar",
          ErrorCodes.BUSINESS_LOGIC_ERROR,
          { status: 409 },
        );
      case "hash-mismatch":
        return apiError(
          "Idempotency-Key sudah dipakai untuk payload berbeda",
          ErrorCodes.BUSINESS_LOGIC_ERROR,
          { status: 409 },
        );
      case "unavailable":
        return apiError(
          "Layanan idempotency tidak tersedia, silakan coba lagi",
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          { status: 503 },
        );
    }
  } catch (error: unknown) {
    logger.error("Leave request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}
