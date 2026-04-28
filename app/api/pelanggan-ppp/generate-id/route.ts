import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { PelangganPppRouteService } from "@/modules/pelanggan";

/**
 * Generate ID pelanggan yang terjamin unik (8 digit)
 *
 * @swagger
 * /api/pelanggan-ppp/generate-id:
 *   get:
 *     tags: [PelangganPPP]
 *     summary: Generate ID pelanggan yang terjamin unik
 *     description: Menghasilkan ID pelanggan 8 digit yang terjamin unik dengan validasi ke database
 *     responses:
 *       200:
 *         description: ID pelanggan berhasil di-generate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idPelanggan:
 *                   type: string
 *                   example: "68001234"
 */
const pelangganPppRouteService = new PelangganPppRouteService();

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const result = await pelangganPppRouteService.generateUniqueId();
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Error generating pelanggan ID:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
