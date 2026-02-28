import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const cookieStore = await cookies()
        const token = cookieStore.get('investor_auth_token')?.value

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const { payload } = await jwtVerify(token, secret)
        const investorId = payload.id as string

        // Verify investor has access to this project
        const rabInvestor = await prisma.rabInvestor.findUnique({
            where: {
                rabProjectId_investorId: {
                    rabProjectId: id,
                    investorId
                }
            },
            include: {
                rabProject: {
                    include: {
                        actualAchievements: true,
                        site: { select: { name: true } },
                        items: true
                    }
                }
            }
        })

        if (!rabInvestor) {
            return NextResponse.json({ message: 'Proyek tidak ditemukan' }, { status: 404 })
        }

        const p = rabInvestor.rabProject

        // Get subscriber growth for this project's site
        let totalSubscribers = 0
        let activeSubscribers = 0
        let payingSubscribers = 0

        if (p.siteId) {
            const customers = await prisma.pelanggan.findMany({
                where: { siteId: p.siteId },
                select: { status: true, jatuhTempo: true }
            })

            totalSubscribers = customers.length
            activeSubscribers = customers.filter(c => c.status === 'AKTIF').length

            const now = new Date()
            payingSubscribers = customers.filter(c => c.status === 'AKTIF' && new Date(c.jatuhTempo) > now).length
        }

        const projectData = {
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            siteName: p.site?.name,
            investmentAmount: rabInvestor.investmentAmount.toString(),
            profitSharePercent: rabInvestor.profitSharePercent,
            projectedRevenue: p.projectedRevenue.toString(),
            projectedOpex: p.projectedOpex.toString(),
            contingencyAmount: p.contingencyAmount.toString(),
            targetSubscribers: p.targetSubscribers,
            growthType: p.growthType,
            createdAt: p.createdAt,
            actualAchievements: p.actualAchievements.map(a => ({
                id: a.id,
                month: a.month,
                year: a.year,
                achievedRevenue: a.actualRevenue.toString(),
                opex: a.actualOpex.toString()
            })),
            subscribers: {
                total: totalSubscribers,
                active: activeSubscribers,
                paying: payingSubscribers,
                paymentRatio: activeSubscribers > 0 ? Math.round((payingSubscribers / activeSubscribers) * 100) : 0
            }
        }

        return NextResponse.json({ project: projectData }, { status: 200 })

    } catch (error) {
        console.error('[INVESTOR_PROJECT_DETAIL] Error:', error)
        return NextResponse.json({ message: 'Terjadi kesalahan' }, { status: 500 })
    }
}
