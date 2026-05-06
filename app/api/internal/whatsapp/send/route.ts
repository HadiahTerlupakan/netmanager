import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ApiErrors } from "@/lib/api";
import {
  WhatsAppSenderService,
  SendWhatsAppMessageSchema,
  BroadcastWhatsAppMessageSchema,
} from "@/modules/notification";

const service = new WhatsAppSenderService();

/**
 * POST /api/internal/whatsapp/send
 * Send WhatsApp message (internal use only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    const body = await req.json();

    // Check if broadcast or single message
    if (body.phones && Array.isArray(body.phones)) {
      // Broadcast
      const validation = BroadcastWhatsAppMessageSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Validasi gagal",
            details: validation.error.issues,
          },
          { status: 400 },
        );
      }

      const data = validation.data;
      const results = await service.broadcast({
        ...data,
        tenantId: session.tenantId,
      });

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      return NextResponse.json({
        success: true,
        data: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          results,
        },
      });
    } else {
      // Single message
      const validation = SendWhatsAppMessageSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Validasi gagal",
            details: validation.error.issues,
          },
          { status: 400 },
        );
      }

      const data = validation.data;
      const result = await service.send({
        ...data,
        tenantId: session.tenantId,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error("[API] POST /api/internal/whatsapp/send error:", error);
    return ApiErrors.internalError();
  }
}
