import { NextResponse } from "next/server";
import { EmployeeLeaveQueryService } from "@/modules/attendance";
import { MobileLeaveRequestService } from "@/modules/attendance";
import {
  createHandler,
  apiError,
  ErrorCodes,
  idempotencyService,
  resolveIdempotencyKey,
  buildIdempotencyRejectionResponse,
} from "@/lib/api";

const employeeLeaveQueryService = new EmployeeLeaveQueryService();
const mobileLeaveRequestService = new MobileLeaveRequestService();

export const GET = createHandler(
  { auth: true, permissions: ["m_izin:read"] },
  async (_request, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId as string;

    const leaves = await employeeLeaveQueryService.getRequests({
      userId,
      tenantId,
    });
    return NextResponse.json({ success: true, data: leaves });
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["m_izin:create"] },
  async (request, ctx) => {
    const tenantId = ctx.session!.user.tenantId as string;
    const userId = ctx.session!.user.id;

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
      default:
        return buildIdempotencyRejectionResponse(outcome);
    }
  },
);
