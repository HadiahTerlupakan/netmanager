import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/procurement/purchase-requests
 * List all Purchase Requests with optional filters
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('purchase_orders:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const skip = parseInt(searchParams.get('skip') || '0')
        const take = parseInt(searchParams.get('take') || '20')

        const where: any = {}
        
        if (status && status !== 'ALL') {
            where.status = status
        }
        
        if (search) {
            where.nomorRequest = { contains: search, mode: 'insensitive' }
        }

        const [data, total] = await Promise.all([
            prisma.purchaseRequest.findMany({
                where,
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
            prisma.purchaseRequest.count({ where })
        ])

        return NextResponse.json({ data, total })
    } catch (error: any) {
        console.error('Error fetching purchase requests:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
