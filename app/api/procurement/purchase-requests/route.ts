import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * GET /api/procurement/purchase-requests
 * List all Purchase Requests with optional filters
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        if (!(await hasPermission('purchase_orders:read'))) {
            return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const skip = parseInt(searchParams.get('skip') || '0')
        const take = parseInt(searchParams.get('take') || '20')

        const where: Prisma.PurchaseRequestWhereInput = {}

        if (status && status !== 'ALL') {
            where.status = status as unknown // Using as any here temporarily as Prisma enums can be tricky with strings, or better:
        }

        if (search) {
            where.nomorRequest = { contains: search, mode: 'insensitive' }
        }

        const [data, total] = await Promise.all([
            prisma.purchaseRequest.findMany({
                where: where as unknown,
                include: {
                    requester: { select: { name: true } },
                    gudang: { select: { nama: true, kode: true } },
                    items: {
                        include: {
                            barang: { select: { nama: true, kode: true, satuan: true } }
                        }
                    },
                    purchaseOrder: { select: { poNumber: true } }
                },
                orderBy: { tanggal: 'desc' },
                skip,
                take
            }),
            prisma.purchaseRequest.count({ where: where as unknown })
        ])

        return NextResponse.json({ data, total })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        console.error('Error fetching purchase requests:', error)
        return NextResponse.json({ error: errorMessage || 'Terjadi kesalahan server' }, { status: 500 })
    }
}
