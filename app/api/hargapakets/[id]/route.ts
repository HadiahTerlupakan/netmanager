import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network/services/HargaPaketService'

const hargaPaketService = new HargaPaketService()

/**
 * @swagger
 * /api/hargapakets/{id}:
 *   get:
 *     summary: Get harga paket by ID
 *     description: Mengambil detail harga paket berdasarkan ID
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail harga paket berhasil diambil
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Harga paket tidak ditemukan
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof NextResponse) return session

        const { id } = await params
        const hargaPaket = await hargaPaketService.getHargaPaketById(id)
        return NextResponse.json(hargaPaket)
    } catch (error: any) {
        console.error('[HargaPaket GET Error]:', error)
        
        if (error.message === 'Harga paket tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/hargapakets/{id}:
 *   put:
 *     summary: Update harga paket
 *     description: Mengupdate data harga paket
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Harga paket berhasil diupdate
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Harga paket tidak ditemukan
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof NextResponse) return session
        
        if (!(await hasPermission('harga:update'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json()

        const updated = await hargaPaketService.updateHargaPaket(id, body, (session as any).user?.id)
        return NextResponse.json(updated)
    } catch (error: any) {
        console.error('[HargaPaket PUT Error]:', error)

        if (error.message === 'Harga paket tidak ditemukan' || error.code === 'P2025') {
            return NextResponse.json({ error: 'Harga paket tidak ditemukan' }, { status: 404 })
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Nama paket sudah digunakan' }, { status: 400 })
        }
        if (error.code === 'P2003') {
            return NextResponse.json({ error: 'Bandwidth atau Profile PPP tidak ditemukan' }, { status: 400 })
        }

        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/hargapakets/{id}:
 *   delete:
 *     summary: Delete harga paket
 *     description: Menghapus harga paket
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Harga paket berhasil dihapus
 *       400:
 *         description: Paket masih digunakan pelanggan
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Harga paket tidak ditemukan
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof NextResponse) return session

        if (!(await hasPermission('harga:delete'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        await hargaPaketService.deleteHargaPaket(id, (session as any).user?.id)
        return NextResponse.json({ message: 'Harga paket berhasil dihapus' })
    } catch (error: any) {
        console.error('[HargaPaket DELETE Error]:', error)

        if (error.message === 'Harga paket tidak ditemukan' || error.code === 'P2025') {
            return NextResponse.json({ error: 'Harga paket tidak ditemukan' }, { status: 404 })
        }
        if (error.message.includes('tidak dapat dihapus') || error.message.includes('masih digunakan')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
