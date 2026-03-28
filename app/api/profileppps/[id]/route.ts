import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { profilePPPSchema } from '@/lib/validations/profileppp'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { deletePPPProfileInMikroTik } from '@/modules/network/services/mikrotik-ppp-profile'
import { Prisma } from '@prisma/client'

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const { id } = await params
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
    })

    if (!profilePPP) {
      return NextResponse.json({ error: 'Profile PPP tidak ditemukan' }, { status: 404 })
    }

    // Jika ada mikroTikRouterId, ambil IP Pool ranges dari MikroTik untuk mengisi ipRangeStart dan ipRangeEnd
    let ipRange: string | null = null
    if (profilePPP.mikroTikRouterId && profilePPP.mikroTikRouter) {
      try {
        const { getIPPoolRanges } = await import('@/modules/network/services/mikrotik-ppp-profile')
        const poolResult = await getIPPoolRanges(profilePPP.mikroTikRouterId, profilePPP.remoteAddress)
        if (poolResult.success && poolResult.ranges) {
          ipRange = poolResult.ranges
        }
      } catch (error: unknown) {
        console.error('[API ProfilePPP] Error getting IP Pool ranges:', error)
        // Jangan gagalkan request, hanya log error
      }
    }

    // Tambahkan ipRange ke response (tidak disimpan di database, hanya untuk frontend)
    return NextResponse.json({
      ...profilePPP,
      ipRange, // Format: "192.168.1.100-192.168.1.200"
    })
  } catch (error: unknown) {
    console.error('Error fetching profile PPP:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const { id } = await params
    const body = await req.json()

    // Ambil data profile lama untuk cek router sebelumnya
    const oldProfile = await prisma.profilePPP.findUnique({
      where: { id },
      include: {
        mikroTikRouter: true,
      },
    })

    if (!oldProfile) {
      return NextResponse.json({ error: 'Profile PPP tidak ditemukan' }, { status: 404 })
    }

    // Sanitize input dan convert empty strings to undefined/null
    const sanitizedBody = {
      name: body.name ? sanitizeInput(body.name) : undefined,
      localAddress: body.localAddress ? sanitizeInput(body.localAddress) : undefined,
      remoteAddress: body.remoteAddress ? sanitizeInput(body.remoteAddress) : undefined,
      // ipRange: Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
      // Digunakan untuk membuat/update IP Pool di MikroTik, tidak disimpan di database
      ipRange: body.ipRange && body.ipRange.trim() ? sanitizeInput(body.ipRange) : undefined,
      dnsServer: body.dnsServer && body.dnsServer.trim() ? sanitizeInput(body.dnsServer) : undefined,
      sessionTimeout: body.sessionTimeout !== undefined && body.sessionTimeout !== null && body.sessionTimeout !== '' ? Number(body.sessionTimeout) : null,
      idleTimeout: body.idleTimeout !== undefined && body.idleTimeout !== null && body.idleTimeout !== '' ? Number(body.idleTimeout) : null,
      poolMode: body.poolMode || 'MIKROTIK',
      // Rate limit diambil dari Bandwidth yang terkait melalui HargaPaket atau bandwidthId langsung
      mikroTikRouterId: body.mikroTikRouterId && body.mikroTikRouterId.trim() ? body.mikroTikRouterId : null,
      bandwidthId: body.bandwidthId && body.bandwidthId.trim() ? body.bandwidthId : null, // Bandwidth untuk rate limit (opsional)
      description: body.description && body.description.trim() ? sanitizeInput(body.description) : null,
      status: body.status || 'AKTIF',
    }

    // Validasi data dengan Zod schema
    const validation = profilePPPSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Pisahkan ipRange dan bandwidthId dari data untuk Prisma
    // ipRange tidak disimpan di database, hanya digunakan untuk membuat/update IP Pool di MikroTik
    // bandwidthId tidak disimpan di database, hanya digunakan untuk mengambil rate limit
    const { ipRange: _ipRange, bandwidthId, ...rawPrismaData } = validation.data

    // Buat objek data explicitly untuk Prisma
    const prismaData = {
      name: rawPrismaData.name,
      localAddress: rawPrismaData.localAddress,
      remoteAddress: rawPrismaData.remoteAddress,
      dnsServer: rawPrismaData.dnsServer !== undefined ? rawPrismaData.dnsServer : null,
      sessionTimeout: rawPrismaData.sessionTimeout !== undefined ? rawPrismaData.sessionTimeout : null,
      idleTimeout: rawPrismaData.idleTimeout !== undefined ? rawPrismaData.idleTimeout : null,
      poolMode: rawPrismaData.poolMode,
      description: rawPrismaData.description !== undefined ? rawPrismaData.description : null,
      status: rawPrismaData.status,
      mikroTikRouterId: rawPrismaData.mikroTikRouterId !== undefined ? rawPrismaData.mikroTikRouterId : null,
      updatedAt: new Date(),
    };

    // Update Profile PPP di database
    const profilePPP = await prisma.profilePPP.update({
      where: { id },
      data: prismaData,
      include: {
        mikroTikRouter: true,
      },
    })

    // Sync to RADIUS if in RADIUS mode
    try {
      const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service');
      const radiusSync = new RadiusSyncService();
      const mode = await radiusSync.getConnectionMode();
      if (mode === 'RADIUS') {
        const { RadiusRepository } = await import('@/modules/network/repositories/RadiusRepository');
        const radiusRepo = new RadiusRepository();
        await radiusRepo.syncProfileToRadius(profilePPP.id);
        
        // Clean up old IP Pool if remoteAddress changed or if no longer in RADIUS mode
        if (oldProfile.poolMode === 'RADIUS' && oldProfile.remoteAddress) {
          if (profilePPP.poolMode !== 'RADIUS' || oldProfile.remoteAddress !== profilePPP.remoteAddress) {
            const tenantId = oldProfile.tenantId || (session.user as { tenantId?: string }).tenantId;
            if (tenantId) {
              await radiusRepo.syncIpPoolToRadius(oldProfile.remoteAddress, '', tenantId); // Passing empty string deletes it
            }
          }
        }

        // Sync IP Pool if currently in RADIUS mode and ipRange is provided
        if (profilePPP.poolMode === 'RADIUS' && sanitizedBody.ipRange) {
           const tenantId = profilePPP.tenantId || (session.user as { tenantId?: string }).tenantId;
           if (tenantId) {
             await radiusRepo.syncIpPoolToRadius(profilePPP.remoteAddress, sanitizedBody.ipRange, tenantId);
           }
        }
      }
    } catch (error) {
      console.error('[API ProfilePPP] RADIUS sync error during update:', error);
    }

    // Update profile PPP di MikroTik jika ada router atau dalam mode RADIUS
    try {
      const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service');
      const radiusSync = new RadiusSyncService();
      const connectionMode = await radiusSync.getConnectionMode();
      const isRadiusMode = connectionMode === 'RADIUS';

      const { updatePPPProfileInMikroTik, getRateLimitFromBandwidth } = await import('@/modules/network/services/mikrotik-ppp-profile');

      if (isRadiusMode) {
        // console.log('[API ProfilePPP] RADIUS mode: broadcasting profile update to all active routers');
        
        // Ambil SEMUA router yang relevan untuk profil ini (berdasarkan tenantId atau siteId)
        const activeRouters = await prisma.mikroTikRouter.findMany({
          where: {
            OR: [
              { tenantId: profilePPP.tenantId },
              { siteId: profilePPP.siteId }
            ]
          }
        });

        for (const router of activeRouters) {
          try {
            // Jika poolMode=MIKROTIK, kita tetap perlu rateLimit dan ipRange di profil MikroTik
            // Jika poolMode=RADIUS, skip keduanya (dikelola FreeRADIUS)
            const isRadiusPool = validation.data.poolMode === 'RADIUS';
            let rateLimit: string | undefined;
            if (!isRadiusPool) {
              const rateLimitResult = await getRateLimitFromBandwidth(profilePPP.id, bandwidthId);
              rateLimit = rateLimitResult || undefined;
            }

            const profilePPPDataForMikrotik = {
              name: validation.data.name,
              localAddress: validation.data.localAddress,
              remoteAddress: validation.data.remoteAddress,
              // ipRange: hanya jika pool di MikroTik
              ...(!isRadiusPool && validation.data.ipRange && { ipRange: validation.data.ipRange }),
              ...(validation.data.dnsServer && { dnsServer: validation.data.dnsServer }),
              ...(validation.data.sessionTimeout && { sessionTimeout: validation.data.sessionTimeout }),
              ...(validation.data.idleTimeout && { idleTimeout: validation.data.idleTimeout }),
              // rateLimit: hanya jika pool di MikroTik
              ...(!isRadiusPool && rateLimit && { rateLimit }),
              skipPoolCheck: isRadiusPool,
            };

            await updatePPPProfileInMikroTik(
              router.id,
              oldProfile.name,
              profilePPPDataForMikrotik
            );
          } catch (routerErr) {
            console.error(`[API ProfilePPP] Failed to update profile in router ${router.name}:`, routerErr);
          }
        }
      } else if (validation.data.mikroTikRouterId && profilePPP.mikroTikRouter) {
        // Mode API MikroTik: Hanya update di router yang dipilih
        // poolMode pasti MIKROTIK di mode ini
        const rateLimit = await getRateLimitFromBandwidth(profilePPP.id, bandwidthId);
        
        const profilePPPDataForMikrotik = {
          name: validation.data.name,
          localAddress: validation.data.localAddress,
          remoteAddress: validation.data.remoteAddress,
          ...(validation.data.ipRange && { ipRange: validation.data.ipRange }),
          ...(validation.data.dnsServer && { dnsServer: validation.data.dnsServer }),
          ...(validation.data.sessionTimeout && { sessionTimeout: validation.data.sessionTimeout }),
          ...(validation.data.idleTimeout && { idleTimeout: validation.data.idleTimeout }),
          ...(rateLimit && { rateLimit }),
          skipPoolCheck: false, // Mode API MikroTik selalu buat pool di router
        };

        await updatePPPProfileInMikroTik(
          validation.data.mikroTikRouterId,
          oldProfile.name,
          profilePPPDataForMikrotik
        );
      }
    } catch (syncError) {
      console.error('[API ProfilePPP] Error during MikroTik profile broadcast:', syncError);
    }

    return NextResponse.json(profilePPP)
  } catch (error: unknown) {
    console.error('Error updating profile PPP:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Profile PPP tidak ditemukan' }, { status: 404 })
      }

      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Nama profile PPP sudah digunakan' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const { id } = await params

    // Ambil data profile sebelum dihapus untuk cek relasi dan hapus di MikroTik
    const profile = await prisma.profilePPP.findUnique({
      where: { id },
      include: {
        mikroTikRouter: true,
        hargaPaket: {
          select: { id: true, name: true }
        }
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile PPP tidak ditemukan' }, { status: 404 })
    }

    // Cek apakah ada HargaPaket yang masih menggunakan profile ini
    if (profile.hargaPaket && profile.hargaPaket.length > 0) {
      const paketNames = profile.hargaPaket.slice(0, 3).map(p => p.name).join(', ')
      const moreCount = profile.hargaPaket.length > 3 ? ` dan ${profile.hargaPaket.length - 3} lainnya` : ''
      return NextResponse.json(
        { 
          error: `Profile PPP "${profile.name}" tidak dapat dihapus karena masih digunakan oleh ${profile.hargaPaket.length} paket (${paketNames}${moreCount}). Hapus atau ubah profile pada paket tersebut terlebih dahulu.` 
        },
        { status: 400 }
      )
    }

    // Hapus dari database
    await prisma.profilePPP.delete({
      where: { id },
    })

    // Hapus profile PPP di MikroTik jika ada router
    // Juga hapus IP Pool yang terkait jika dibuat oleh netmanager
    if (profile.mikroTikRouterId && profile.mikroTikRouter) {
      try {
        const mikrotikResult = await deletePPPProfileInMikroTik(
          profile.mikroTikRouterId,
          profile.name,
          profile.remoteAddress // Kirim remoteAddress untuk menghapus IP Pool yang terkait
        )

        if (!mikrotikResult.success) {
          console.error('Failed to delete PPP profile in MikroTik:', mikrotikResult.error)
          // Jangan gagalkan request, hanya log error
        }
      } catch (mikrotikError: unknown) {
        console.error('Error deleting PPP profile in MikroTik:', mikrotikError)
        // Jangan gagalkan request, hanya log error
      }
    }

    return NextResponse.json({ message: 'Profile PPP berhasil dihapus' })
  } catch (error: unknown) {
    console.error('Error deleting profile PPP:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Profile PPP tidak ditemukan' }, { status: 404 })
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Profile PPP tidak dapat dihapus karena masih digunakan oleh paket' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
