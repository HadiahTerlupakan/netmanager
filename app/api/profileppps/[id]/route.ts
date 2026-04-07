import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/modules/database";
import { profilePPPSchema } from "@/lib/validations/profileppp";
import { sanitizeInput } from "@/lib/utils/sanitize";
import { deletePPPProfileInMikroTik } from "@/modules/network";
import { ProfilePPPService } from "@/modules/network";
import { Prisma } from "@prisma/client";

const profilePPPService = new ProfilePPPService();

/**
 * @swagger
 * /api/profileppps/{id}:
 *   get:
 *     summary: Get profile PPP by ID
 *     description: Mengambil detail profile PPP berdasarkan ID
 *     tags: [ProfilePPP]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile PPP ID
 *     responses:
 *       200:
 *         description: Detail profile PPP berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clx1234567890
 *                 name:
 *                   type: string
 *                   example: "10Mbps-Profile"
 *                 localAddress:
 *                   type: string
 *                   example: "192.168.1.1"
 *                 remoteAddress:
 *                   type: string
 *                   example: "192.168.1.100"
 *                 dnsServer:
 *                   type: string
 *                   nullable: true
 *                   example: "8.8.8.8,8.8.4.4"
 *                 sessionTimeout:
 *                   type: integer
 *                   nullable: true
 *                   example: 600
 *                 idleTimeout:
 *                   type: integer
 *                   nullable: true
 *                   example: 300
 *                 status:
 *                   type: string
 *                   enum: ["AKTIF", "NONAKTIF"]
 *                   example: "AKTIF"
 *                 ipRange:
 *                   type: string
 *                   nullable: true
 *                   example: "192.168.1.100-192.168.1.200"
 *                 mikroTikRouter:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     ipAddress:
 *                       type: string
 *                 hargaPakets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       bandwidth:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Profile PPP tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;
    const profilePPP = await prisma.profilePPP.findUnique({
      where: { id },
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
        mikroTikRouter: true,
      },
    });

    if (!profilePPP) {
      return NextResponse.json(
        { error: "Profile PPP tidak ditemukan" },
        { status: 404 },
      );
    }

    // Jika ada mikroTikRouterId, ambil IP Pool ranges dari MikroTik untuk mengisi ipRangeStart dan ipRangeEnd
    let ipRange: string | null = null;
    if (profilePPP.mikroTikRouterId && profilePPP.mikroTikRouter) {
      try {
        const { getIPPoolRanges } = await import("@/modules/network");
        const poolResult = await getIPPoolRanges(
          profilePPP.mikroTikRouterId,
          profilePPP.remoteAddress,
        );
        if (poolResult.success && poolResult.ranges) {
          ipRange = poolResult.ranges;
        }
      } catch (error: unknown) {
        console.error("[API ProfilePPP] Error getting IP Pool ranges:", error);
        // Jangan gagalkan request, hanya log error
      }
    }

    // Tambahkan ipRange ke response (tidak disimpan di database, hanya untuk frontend)
    return NextResponse.json({
      ...profilePPP,
      ipRange, // Format: "192.168.1.100-192.168.1.200"
    });
  } catch (error: unknown) {
    console.error("Error fetching profile PPP:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/profileppps/{id}:
 *   put:
 *     summary: Update profile PPP
 *     description: Mengupdate data profile PPP
 *     tags: [ProfilePPP]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile PPP ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "10Mbps-Profile"
 *                 description: Nama profile PPP
 *               localAddress:
 *                 type: string
 *                 example: "192.168.1.1"
 *                 description: Alamat local untuk PPP
 *               remoteAddress:
 *                 type: string
 *                 example: "192.168.1.100"
 *                 description: Alamat remote/nama pool untuk PPP
 *               dnsServer:
 *                 type: string
 *                 nullable: true
 *                 example: "8.8.8.8,8.8.4.4"
 *                 description: Server DNS
 *               sessionTimeout:
 *                 type: integer
 *                 nullable: true
 *                 example: 600
 *                 description: Timeout sesi dalam detik
 *               idleTimeout:
 *                 type: integer
 *                 nullable: true
 *                 example: 300
 *                 description: Timeout idle dalam detik
 *               ipRange:
 *                 type: string
 *                 nullable: true
 *                 example: "192.168.1.100-192.168.1.200"
 *                 description: Range IP untuk pool dengan format start-end
 *               mikroTikRouterId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID MikroTik Router
 *               bandwidthId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID Bandwidth untuk rate limit
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Profile untuk paket 10 Mbps"
 *                 description: Deskripsi profile
 *               status:
 *                 type: string
 *                 enum: ["AKTIF", "NONAKTIF"]
 *                 default: "AKTIF"
 *                 example: "AKTIF"
 *                 description: Status profile
 *     responses:
 *       200:
 *         description: Profile PPP berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfilePPP'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Profile PPP tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;
    const body = await req.json();

    // Ambil data profile lama untuk cek router sebelumnya
    const oldProfile = await prisma.profilePPP.findUnique({
      where: { id },
      include: {
        mikroTikRouter: true,
      },
    });

    if (!oldProfile) {
      return NextResponse.json(
        { error: "Profile PPP tidak ditemukan" },
        { status: 404 },
      );
    }

    // Sanitize input dan convert empty strings to undefined/null
    const sanitizedBody = {
      name: body.name ? sanitizeInput(body.name) : undefined,
      localAddress: body.localAddress
        ? sanitizeInput(body.localAddress)
        : undefined,
      remoteAddress: body.remoteAddress
        ? sanitizeInput(body.remoteAddress)
        : undefined,
      // ipRange: Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
      // Digunakan untuk membuat/update IP Pool di MikroTik, tidak disimpan di database
      ipRange:
        body.ipRange && body.ipRange.trim()
          ? sanitizeInput(body.ipRange)
          : undefined,
      dnsServer:
        body.dnsServer && body.dnsServer.trim()
          ? sanitizeInput(body.dnsServer)
          : undefined,
      sessionTimeout:
        body.sessionTimeout !== undefined &&
        body.sessionTimeout !== null &&
        body.sessionTimeout !== ""
          ? Number(body.sessionTimeout)
          : null,
      idleTimeout:
        body.idleTimeout !== undefined &&
        body.idleTimeout !== null &&
        body.idleTimeout !== ""
          ? Number(body.idleTimeout)
          : null,
      poolMode: body.poolMode || "MIKROTIK",
      // Rate limit diambil dari Bandwidth yang terkait melalui HargaPaket atau bandwidthId langsung
      mikroTikRouterId:
        body.mikroTikRouterId && body.mikroTikRouterId.trim()
          ? body.mikroTikRouterId
          : null,
      bandwidthId:
        body.bandwidthId && body.bandwidthId.trim() ? body.bandwidthId : null, // Bandwidth untuk rate limit (opsional)
      description:
        body.description && body.description.trim()
          ? sanitizeInput(body.description)
          : null,
      status: body.status || "AKTIF",
    };

    // Validasi data dengan Zod schema
    const validation = profilePPPSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const profilePPP = await profilePPPService.updateProfilePPP(
      {
        user: {
          id: session.user.id!,
          tenantId: session.user.tenantId ?? undefined,
        },
      },
      id,
      oldProfile as typeof oldProfile & { tenantId?: string | null },
      validation.data,
    );

    return NextResponse.json(profilePPP);
  } catch (error: unknown) {
    console.error("Error updating profile PPP:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Profile PPP tidak ditemukan" },
          { status: 404 },
        );
      }

      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Nama profile PPP sudah digunakan" },
          { status: 400 },
        );
      }
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

/**
 * @swagger
 * /api/profileppps/{id}:
 *   delete:
 *     summary: Delete profile PPP
 *     description: Menghapus profile PPP
 *     tags: [ProfilePPP]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile PPP ID
 *     responses:
 *       200:
 *         description: Profile PPP berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile PPP berhasil dihapus"
 *       400:
 *         description: Profile PPP tidak dapat dihapus karena masih digunakan oleh paket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Profile PPP tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) {
      return session; // Return error response if authentication fails
    }

    const { id } = await params;

    // Ambil data profile sebelum dihapus untuk cek relasi dan hapus di MikroTik
    const profile = await prisma.profilePPP.findUnique({
      where: { id },
      include: {
        mikroTikRouter: true,
        hargaPaket: {
          select: { id: true, name: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile PPP tidak ditemukan" },
        { status: 404 },
      );
    }

    // Cek apakah ada HargaPaket yang masih menggunakan profile ini
    if (profile.hargaPaket && profile.hargaPaket.length > 0) {
      const paketNames = profile.hargaPaket
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ");
      const moreCount =
        profile.hargaPaket.length > 3
          ? ` dan ${profile.hargaPaket.length - 3} lainnya`
          : "";
      return NextResponse.json(
        {
          error: `Profile PPP "${profile.name}" tidak dapat dihapus karena masih digunakan oleh ${profile.hargaPaket.length} paket (${paketNames}${moreCount}). Hapus atau ubah profile pada paket tersebut terlebih dahulu.`,
        },
        { status: 400 },
      );
    }

    // Hapus dari database
    await prisma.profilePPP.delete({
      where: { id },
    });

    // Hapus profile PPP di MikroTik jika ada router
    // Juga hapus IP Pool yang terkait jika dibuat oleh netmanager
    if (profile.mikroTikRouterId && profile.mikroTikRouter) {
      try {
        const mikrotikResult = await deletePPPProfileInMikroTik(
          profile.mikroTikRouterId,
          profile.name,
          profile.remoteAddress, // Kirim remoteAddress untuk menghapus IP Pool yang terkait
        );

        if (!mikrotikResult.success) {
          console.error(
            "Failed to delete PPP profile in MikroTik:",
            mikrotikResult.error,
          );
          // Jangan gagalkan request, hanya log error
        }
      } catch (mikrotikError: unknown) {
        console.error("Error deleting PPP profile in MikroTik:", mikrotikError);
        // Jangan gagalkan request, hanya log error
      }
    }

    return NextResponse.json({ message: "Profile PPP berhasil dihapus" });
  } catch (error: unknown) {
    console.error("Error deleting profile PPP:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Profile PPP tidak ditemukan" },
          { status: 404 },
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Profile PPP tidak dapat dihapus karena masih digunakan oleh paket",
          },
          { status: 400 },
        );
      }
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
