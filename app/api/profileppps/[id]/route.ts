import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { ProfilePPPService, getIPPoolRanges } from "@/modules/network";
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
    const profilePPP = await profilePPPService.getProfilePPPDetail({
      id,
      getIPPoolRanges,
    });

    if (!profilePPP) {
      return NextResponse.json(
        { error: "Profile PPP tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(profilePPP);
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

    const result = await profilePPPService.updateProfilePPPFromRequest({
      session,
      sessionContext: {
        user: {
          id: session.user.id!,
          tenantId: session.user.tenantId ?? undefined,
        },
      },
      id,
      body,
    });

    if (!result.success) {
      return NextResponse.json(
        result.details
          ? { error: result.error, details: result.details }
          : { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result.profilePPP);
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
    const result = await profilePPPService.deleteProfilePPPFromRequest({
      session,
      id,
    });

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ message: result.message });
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
