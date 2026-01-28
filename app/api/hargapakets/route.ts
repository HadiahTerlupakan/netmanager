import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network/services/HargaPaketService'

const hargaPaketService = new HargaPaketService()

/**
 * @swagger
 * /api/hargapakets:
 *   get:
 *     summary: Get all harga pakets
 *     description: Mengambil daftar semua harga paket dengan filter opsional
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["AKTIF", "NONAKTIF"]
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: siteId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Daftar harga paket berhasil diambil
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('harga:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') || undefined
        const featured = searchParams.get('featured')
        const siteIdParam = searchParams.get('siteId')

        // Build filter options
        const options: any = {}
        if (status) options.status = status
        if (featured !== null) options.featured = featured === 'true'

        // Site restriction logic
        const isSiteRestricted = (await hasPermission('harga:site_only')) && session.user.role !== 'SUPER_ADMIN'
        const userSiteId = (session.user as any).siteId

        if (isSiteRestricted) {
            if (!userSiteId) return NextResponse.json([])
            options.siteId = userSiteId
        } else if (siteIdParam) {
            options.siteId = siteIdParam
        }

        const hargaPakets = await hargaPaketService.getAllHargaPakets(options)
        return NextResponse.json(hargaPakets)
    } catch (error: any) {
        console.error('[HargaPaket GET Error]:', error)
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/hargapakets:
 *   post:
 *     summary: Create new harga paket
 *     description: Membuat harga paket baru
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Harga paket berhasil dibuat
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('harga:create'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()

        // Site restriction - force siteId if restricted
        const isSiteRestricted = (await hasPermission('harga:site_only')) && session.user.role !== 'SUPER_ADMIN'
        const userSiteId = (session.user as any).siteId

        if (isSiteRestricted) {
            if (!userSiteId) {
                return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
            }
            body.siteId = userSiteId
        }

        const hargaPaket = await hargaPaketService.createHargaPaket(body, session.user.id)
        return NextResponse.json(hargaPaket, { status: 201 })
    } catch (error: any) {
        console.error('[HargaPaket POST Error]:', error)

        // Handle validation error from service
        if (error.code === 'VALIDATION_ERROR') {
            return NextResponse.json(
                { error: error.message, details: error.details },
                { status: 400 }
            )
        }

        // Handle Prisma unique constraint
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Nama paket sudah digunakan' }, { status: 400 })
        }

        // Handle Prisma foreign key constraint
        if (error.code === 'P2003') {
            return NextResponse.json({ error: 'Bandwidth atau Profile PPP tidak ditemukan' }, { status: 400 })
        }

        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
