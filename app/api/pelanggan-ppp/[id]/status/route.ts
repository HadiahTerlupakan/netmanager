import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { requireAdmin } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { getPelangganService } from "@/modules/pelanggan";
import { Status } from "@prisma/client";

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

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
    });

    if (!pelanggan) {
      return NextResponse.json(
        { error: "Pelanggan not found" },
        { status: 404 },
      );
    }

    const updatedPelanggan = await getPelangganService().updateStatusPelanggan(
      id,
      status,
    );

    // Logging
    await logger.logActivity({
      action: "UPDATE",
      subject: "Pelanggan Status",
      details: {
        id: pelanggan.id,
        name: pelanggan.nama,
        oldStatus: pelanggan.status,
        newStatus: status,
        actor: session.user.name || "Admin",
      },
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: updatedPelanggan,
      message: `Status updated to ${status}`,
    });
  } catch (error: unknown) {
    console.error("[API] Error updating status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
