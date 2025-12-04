import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository, getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
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
        const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

        const tagihanRepo = getTagihanRepository()
        const pengeluaranRepo = getPengeluaranRepository()
        const pemasukanRepo = getPemasukanRepository()

        // Get revenue data
        const [
            totalTagihanLunas,
            totalPemasukanManualBigInt,
            tagihanByCategory
        ] = await Promise.all([
            tagihanRepo.aggregateTotalByStatusAndPeriod('LUNAS', parseInt(month), parseInt(year)),
            pemasukanRepo.aggregateTotalByPeriod(parseInt(month), parseInt(year)),
            tagihanRepo.groupByCategoryAndPeriod(parseInt(month), parseInt(year))
        ])

        const totalPemasukanManual = Number(totalPemasukanManualBigInt)
        const totalPemasukan = totalTagihanLunas + totalPemasukanManual

        // Get expense data by category
        const [
            totalPengeluaranBigInt,
            totalCapexBigInt,
            totalOpexBigInt,
            pengeluaranByCategory
        ] = await Promise.all([
            pengeluaranRepo.aggregateTotalByPeriod(parseInt(month), parseInt(year)),
            pengeluaranRepo.aggregateTotalByTipeAndPeriod('CAPEX', parseInt(month), parseInt(year)),
            pengeluaranRepo.aggregateTotalByTipeAndPeriod('OPEX', parseInt(month), parseInt(year)),
            pengeluaranRepo.groupByCategoryAndPeriod(parseInt(month), parseInt(year))
        ])

        const totalPengeluaran = Number(totalPengeluaranBigInt)
        const totalCapex = Number(totalCapexBigInt)
        const totalOpex = Number(totalOpexBigInt)

        // Calculate profit metrics
        const grossProfit = totalPemasukan - totalPengeluaran
        const operatingProfit = grossProfit // Simplified calculation, in real implementation would exclude non-operating items
        const netProfit = operatingProfit // Simplified calculation, in real implementation would include taxes and interest
        const profitMargin = totalPemasukan > 0 ? (netProfit / totalPemasukan) * 100 : 0

        // Format revenue breakdown
        const revenueBreakdown = [
            { category: 'Tagihan Langganan', amount: totalTagihanLunas, type: 'subscription' },
            { category: 'Pemasukan Manual', amount: totalPemasukanManual, type: 'manual' }
        ]

        // Add tagihan categories to revenue breakdown
        if (tagihanByCategory && tagihanByCategory.length > 0) {
            tagihanByCategory.forEach((item: any) => {
                revenueBreakdown.push({
                    category: item.kategori || 'Lainnya',
                    amount: Number(item._sum.total || 0),
                    type: 'subscription'
                })
            })
        }

        // Format expense breakdown
        const expensesBreakdown = []
        
        // Add OPEX categories
        if (pengeluaranByCategory && pengeluaranByCategory.length > 0) {
            pengeluaranByCategory.forEach((item: any) => {
                if (item.tipePengeluaran === 'OPEX') {
                    expensesBreakdown.push({
                        category: item.kategori || 'Lainnya',
                        amount: Number(item._sum.jumlah || 0),
                        type: 'OPEX'
                    })
                }
            })
        }

        // Add CAPEX categories
        if (pengeluaranByCategory && pengeluaranByCategory.length > 0) {
            pengeluaranByCategory.forEach((item: any) => {
                if (item.tipePengeluaran === 'CAPEX') {
                    expensesBreakdown.push({
                        category: item.kategori || 'Lainnya',
                        amount: Number(item._sum.jumlah || 0),
                        type: 'CAPEX'
                    })
                }
            })
        }

        console.log('[P&L API] Report Data:', {
            revenue: {
                total: totalPemasukan,
                breakdown: revenueBreakdown
            },
            expenses: {
                total: totalPengeluaran,
                opex: totalOpex,
                capex: totalCapex,
                breakdown: expensesBreakdown
            },
            grossProfit,
            operatingProfit,
            netProfit,
            profitMargin
        })

        return NextResponse.json({
            revenue: {
                total: totalPemasukan,
                breakdown: revenueBreakdown
            },
            expenses: {
                total: totalPengeluaran,
                opex: totalOpex,
                capex: totalCapex,
                breakdown: expensesBreakdown
            },
            grossProfit,
            operatingProfit,
            netProfit,
            profitMargin
        })

    } catch (error: any) {
        console.error('Error fetching P&L report:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
