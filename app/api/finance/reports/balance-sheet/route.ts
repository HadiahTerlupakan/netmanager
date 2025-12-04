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

        // Get data for balance sheet
        const [
            totalTagihanLunas,
            totalTagihanBelumLunas,
            totalPemasukanManualBigInt,
            totalPengeluaranBigInt,
            totalCapexBigInt,
            totalOpexBigInt
        ] = await Promise.all([
            tagihanRepo.aggregateTotalByStatusAndPeriod('LUNAS', parseInt(month), parseInt(year)),
            tagihanRepo.aggregateTotalByStatusAndPeriod('BELUM_LUNAS', parseInt(month), parseInt(year)),
            pemasukanRepo.aggregateTotalByPeriod(parseInt(month), parseInt(year)),
            pengeluaranRepo.aggregateTotalByPeriod(parseInt(month), parseInt(year)),
            pengeluaranRepo.aggregateTotalByTipeAndPeriod('CAPEX', parseInt(month), parseInt(year)),
            pengeluaranRepo.aggregateTotalByTipeAndPeriod('OPEX', parseInt(month), parseInt(year))
        ])

        const totalPemasukanManual = Number(totalPemasukanManualBigInt)
        const totalPemasukan = totalTagihanLunas + totalPemasukanManual
        const totalPengeluaran = Number(totalPengeluaranBigInt)
        const totalCapex = Number(totalCapexBigInt)
        const totalOpex = Number(totalOpexBigInt)
        
        // Calculate balance sheet components
        // Assets
        const currentAssets = totalPemasukan // Simplified, in real implementation would include cash, receivables, etc.
        const fixedAssets = totalCapex // Simplified, in real implementation would include equipment, buildings, etc.
        const totalAssets = currentAssets + fixedAssets
        
        // Liabilities
        const currentLiabilities = totalTagihanBelumLunas // Simplified, in real implementation would include payables, etc.
        const longTermLiabilities = 0 // Simplified, in real implementation would include loans, etc.
        const totalLiabilities = currentLiabilities + longTermLiabilities
        
        // Equity
        const initialEquity = 0 // Simplified, in real implementation would include owner's investment, etc.
        const retainedEarnings = totalPemasukan - totalPengeluaran // Simplified calculation
        const totalEquity = initialEquity + retainedEarnings
        
        // Calculate financial ratios
        const currentRatio = totalLiabilities > 0 ? (currentAssets / totalLiabilities) : 0
        const debtToEquityRatio = totalEquity > 0 ? (totalLiabilities / totalEquity) : 0

        console.log('[Balance Sheet API] Report Data:', {
            assets: {
                current: currentAssets,
                fixed: fixedAssets,
                total: totalAssets
            },
            liabilities: {
                current: currentLiabilities,
                longTerm: longTermLiabilities,
                total: totalLiabilities
            },
            equity: {
                initial: initialEquity,
                retained: retainedEarnings,
                total: totalEquity
            },
            ratios: {
                currentRatio,
                debtToEquityRatio
            }
        })

        return NextResponse.json({
            assets: {
                current: currentAssets,
                fixed: fixedAssets,
                total: totalAssets
            },
            liabilities: {
                current: currentLiabilities,
                longTerm: longTermLiabilities,
                total: totalLiabilities
            },
            equity: {
                initial: initialEquity,
                retained: retainedEarnings,
                total: totalEquity
            },
            ratios: {
                currentRatio,
                debtToEquityRatio
            }
        })

    } catch (error: any) {
        console.error('Error fetching balance sheet report:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
