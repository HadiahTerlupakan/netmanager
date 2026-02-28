import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('investor_auth_token')?.value

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const { payload } = await jwtVerify(token, secret)
        const investorId = payload.id as string

        // Fetch projects where investor is involved
        const rabInvestors = await prisma.rabInvestor.findMany({
            where: { investorId },
            include: {
                rabProject: {
                    include: {
                        actualAchievements: true,
                        items: true
                    }
                }
            }
        })

        // Calculate metrics
        let totalInvestment = BigInt(0)
        let totalProjectedRevenue = BigInt(0)
        let totalActualRevenue = BigInt(0)
        const activeProjectsCount = rabInvestors.length

        // Compile site IDs to measure subscriber growth accurately
        const siteIds = [...new Set(rabInvestors
            .map(ri => ri.rabProject.siteId)
            .filter((id): id is string => id !== null))]

        let totalSubscribers = 0
        let activeSubscribers = 0
        let payingSubscribers = 0

        if (siteIds.length > 0) {
            const customers = await prisma.pelanggan.findMany({
                where: { siteId: { in: siteIds } },
                select: { status: true, idPelanggan: true, jatuhTempo: true }
            })

            totalSubscribers = customers.length
            activeSubscribers = customers.filter(c => c.status === 'AKTIF').length

            const now = new Date()
            payingSubscribers = customers.filter(c => c.status === 'AKTIF' && c.jatuhTempo > now).length
        }

        for (const ri of rabInvestors) {
            totalInvestment += ri.investmentAmount

            const netProjected = Math.max(0, Number(ri.rabProject.projectedRevenue) - Number(ri.rabProject.projectedOpex) - Number(ri.rabProject.contingencyAmount))
            const projRev = netProjected * (ri.profitSharePercent / 100)
            totalProjectedRevenue += BigInt(Math.floor(projRev))

            for (const ach of ri.rabProject.actualAchievements) {
                const netActual = Math.max(0, Number(ach.actualRevenue) - Number(ach.actualOpex || 0))
                const actRev = netActual * (ri.profitSharePercent / 100)
                totalActualRevenue += BigInt(Math.floor(actRev))
            }
        }

        return NextResponse.json({
            totalInvestment: totalInvestment.toString(),
            totalProjectedRevenue: totalProjectedRevenue.toString(),
            totalActualRevenue: totalActualRevenue.toString(),
            activeProjectsCount,
            subscribers: {
                total: totalSubscribers,
                active: activeSubscribers,
                paying: payingSubscribers,
                paymentRatio: activeSubscribers > 0 ? Math.round((payingSubscribers / activeSubscribers) * 100) : 0
            }
        }, { status: 200 })

    } catch (error) {
        console.error('[INVESTOR_DASHBOARD] Error:', error)
        return NextResponse.json({ message: 'Terjadi kesalahan' }, { status: 500 })
    }
}
