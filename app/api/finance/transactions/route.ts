import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('x-finance-token')
        let userId: string | undefined

        if (token) {
            // Verify finance token
            try {
                const tokenData = Buffer.from(token, 'base64').toString('utf8')
                const [uid, timestamp] = tokenData.split(':')
                userId = uid

                if (!userId) {
                    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
                }

                // Check token expiry
                const tokenTime = parseInt(timestamp)
                const now = Date.now()
                const tokenAge = now - tokenTime
                const maxAge = 24 * 60 * 60 * 1000

                if (tokenAge > maxAge) {
                    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
                }
            } catch (parseError) {
                return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
            }
        } else {
            // Verify NextAuth session
            const session = await getServerSession(authConfig)
            if (session?.user?.id) {
                userId = session.user.id
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        // Verify user exists and has FINANCE or ADMIN role
        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        const allowedRoles = ['FINANCE', 'ADMIN'] as const
        if (!user || !allowedRoles.includes(user.role as any)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Parse Query Parameters
        const searchParams = request.nextUrl.searchParams
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const type = searchParams.get('type') || 'all' // 'all', 'pemasukan', 'pengeluaran'
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')

        const startDate = startDateStr ? new Date(startDateStr) : undefined
        const endDate = endDateStr ? new Date(endDateStr) : undefined

        const pengeluaranRepo = getPengeluaranRepository()
        const pemasukanRepo = getPemasukanRepository()

        let items: { id: string, tanggal: Date, type: 'pemasukan' | 'pengeluaran' }[] = []

        // Fetch IDs and Dates based on type
        if (type === 'all' || type === 'pemasukan') {
            const pemasukanItems = await pemasukanRepo.findIdsAndDates(startDate, endDate)
            items = [...items, ...pemasukanItems.map(i => ({ ...i, type: 'pemasukan' as const }))]
        }

        if (type === 'all' || type === 'pengeluaran') {
            const pengeluaranItems = await pengeluaranRepo.findIdsAndDates(startDate, endDate)
            items = [...items, ...pengeluaranItems.map(i => ({ ...i, type: 'pengeluaran' as const }))]
        }

        // Sort by Date DESC
        items.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime())

        // Pagination Logic
        const total = items.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedItems = items.slice(offset, offset + limit)

        // Fetch Full Details for Paginated Items
        const fullDetails = await Promise.all(paginatedItems.map(async (item) => {
            if (item.type === 'pemasukan') {
                const detail = await pemasukanRepo.findById(item.id)
                return detail ? { ...detail, type: 'pemasukan' } : null
            } else {
                const detail = await pengeluaranRepo.findById(item.id)
                return detail ? { ...detail, type: 'pengeluaran' } : null
            }
        }))

        // Filter out nulls (should not happen usually)
        const validDetails = fullDetails.filter(item => item !== null)

        return NextResponse.json({
            data: validDetails,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        })

    } catch (error: any) {
        console.error('Error fetching transactions:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
