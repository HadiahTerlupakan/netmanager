import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { PelangganPppRouteService } from "@/modules/pelanggan";

/**
 * Cek apakah ID Pelanggan sudah ada (untuk validasi duplikat)
 *
 * @swagger
 * /api/pelanggan-ppp/check-id:
 *   get:
 *     tags: [PelangganPPP]
 *     summary: Cek apakah ID pelanggan sudah digunakan
 *     description: Mengecek apakah ID pelanggan sudah ada di database untuk mencegah duplikat
 *     parameters:
 *       - in: query
 *         name: idPelanggan
 *         required: true
 *         schema:
 *           type: string
 *         description: ID pelanggan yang akan dicek
 *     responses:
 *       200:
 *         description: Status keberadaan ID pelanggan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: false
 */
const pelangganPppRouteService = new PelangganPppRouteService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const idPelanggan = searchParams.get("idPelanggan");

    if (!idPelanggan || idPelanggan.trim() === "") {
      return NextResponse.json(
        { error: "ID Pelanggan harus diisi" },
        { status: 400 },
      );
    }

    if (!/^\d{8}$/.test(idPelanggan.trim())) {
      return NextResponse.json(
        { error: "ID Pelanggan harus 8 digit angka" },
        { status: 400 },
      );
    }

    const result = await pelangganPppRouteService.checkIdExists(
      idPelanggan.trim(),
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Error checking pelanggan ID:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
