import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { profilePPPSchema } from "@/lib/validations/profileppp";
import { sanitizeInput } from "@/lib/utils/sanitize";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { checkSiteRestriction } from "@/modules/roles";
import { ProfilePPPService } from "@/modules/network";

const profilePPPService = new ProfilePPPService();

/**
 * GET /api/profileppps
 * Mendapatkan semua data Profile PPP
 *
 * @swagger
 * /api/profileppps:
 *   get:
 *     tags: [ProfilePPP]
 *     summary: Mendapatkan semua data profile PPP
 *     responses:
 *       200:
 *         description: List profile PPP
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi menggunakan fungsi terpusat
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    if (!(await hasPermission("profileppp:read"))) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const siteIdParam = searchParams.get("siteId");

    const where: Prisma.ProfilePPPWhereInput = {};
    if (status) {
      where.status = status as "AKTIF" | "NONAKTIF";
    }

    // User restriction logic
    const { isRestricted, siteIds } = checkSiteRestriction(
      session,
      "profileppp",
    );

    if (isRestricted && siteIds.length > 0) {
      where.OR = [{ siteId: { in: siteIds } }, { siteId: null }];
    } else if (siteIdParam) {
      where.OR = [{ siteId: siteIdParam }, { siteId: null }];
    }

    const profilePPPs = await prisma.profilePPP.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        mikroTikRouter: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
        _count: {
          select: { hargaPaket: true },
        },
      },
    });

    return NextResponse.json(profilePPPs);
  } catch (error: unknown) {
    console.error("Error fetching profile PPPs:", error);
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
 * /api/profileppps:
 *   post:
 *     summary: Create new profile PPP
 *     description: Membuat profile PPP baru
 *     tags: [ProfilePPP]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - localAddress
 *               - remoteAddress
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
 *                 description: "Range IP untuk pool (format: start-end)"
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
 *       201:
 *         description: Profile PPP berhasil dibuat
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
 *       409:
 *         description: Nama profile PPP sudah digunakan
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
/**
 * POST /api/profileppps
 * Membuat Profile PPP baru
 *
 * Alur:
 * 1. Validasi input (termasuk ipRange untuk IP Pool)
 * 2. Simpan Profile PPP ke database (tanpa ipRange, karena tidak disimpan)
 * 3. Jika ada mikroTikRouterId:
 *    - Buat IP Pool di MikroTik (jika ipRange disediakan)
 *    - Buat Profile PPP di MikroTik dengan remote-address = nama IP Pool
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    if (!(await hasPermission("profileppp:create"))) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const body = await req.json();
    const sanitizedBody = {
      name: body.name ? sanitizeInput(body.name) : undefined,
      localAddress: body.localAddress
        ? sanitizeInput(body.localAddress)
        : undefined,
      remoteAddress: body.remoteAddress
        ? sanitizeInput(body.remoteAddress)
        : undefined,
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
          : undefined,
      idleTimeout:
        body.idleTimeout !== undefined &&
        body.idleTimeout !== null &&
        body.idleTimeout !== ""
          ? Number(body.idleTimeout)
          : undefined,
      poolMode: body.poolMode || "MIKROTIK",
      mikroTikRouterId:
        body.mikroTikRouterId && body.mikroTikRouterId.trim()
          ? body.mikroTikRouterId
          : undefined,
      bandwidthId:
        body.bandwidthId && body.bandwidthId.trim()
          ? body.bandwidthId
          : undefined,
      description:
        body.description && body.description.trim()
          ? sanitizeInput(body.description)
          : undefined,
      status: body.status || "AKTIF",
      siteId: body.siteId || undefined,
    };

    const { isRestricted, primarySiteId } = checkSiteRestriction(
      session,
      "profileppp",
    );
    if (isRestricted && primarySiteId) {
      sanitizedBody.siteId = primarySiteId;
    }

    await import("@/lib/logger").then(({ logger }) => {
      logger.info("Creating Profile PPP", {
        userId: session.user.id,
        siteId: sanitizedBody.siteId,
        name: sanitizedBody.name,
      });
    });

    const validation = profilePPPSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const profilePPP = await profilePPPService.createProfilePPP(
      {
        user: {
          id: session.user.id!,
          tenantId: session.user.tenantId ?? undefined,
        },
      },
      validation.data,
    );

    return NextResponse.json(profilePPP, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating profile PPP:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
