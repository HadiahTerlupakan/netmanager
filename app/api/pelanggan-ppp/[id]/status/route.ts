import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";
import { Status } from "@prisma/client";

const pelangganPppRouteService = new PelangganPppRouteService();

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin(req);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const body = await req.json();
    const { status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!status || !Object.values(Status).includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required" },
        { status: 400 },
      );
    }

    const result = await pelangganPppRouteService.updateCustomerStatus({
      id,
      status,
    });

    await logger.logActivity({
      action: "UPDATE",
      subject: "Pelanggan Status",
      details: {
        id: result.pelanggan.id,
        name: result.pelanggan.nama,
        oldStatus: result.pelanggan.status,
        newStatus: status,
        actor: session.user.name || "Admin",
      },
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: result.updatedPelanggan,
      message: result.message,
    });
  } catch (error: unknown) {
    console.error("[API] Error updating status:", error);
    if (error instanceof RouteServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
