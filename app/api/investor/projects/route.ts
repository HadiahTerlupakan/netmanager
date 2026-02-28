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
                        site: { select: { name: true } }
                    }
                }
            },
            orderBy: {
                rabProject: {
                    createdAt: 'desc'
                }
            }
        })

        const projects = rabInvestors.map(ri => {
            const p = ri.rabProject

            let totalActualRevenue = 0;
            let totalActualOpex = 0;

            p.actualAchievements.forEach(ach => {
                totalActualRevenue += Number(ach.actualRevenue);
                totalActualOpex += Number(ach.actualOpex || 0);
            });

            return {
                id: p.id,
                name: p.name,
                description: p.description,
                status: p.status,
                siteName: p.site?.name,
                investmentAmount: ri.investmentAmount.toString(),
                profitSharePercent: ri.profitSharePercent,
                projectedRevenue: p.projectedRevenue.toString(),
                projectedOpex: p.projectedOpex.toString(),
                contingencyAmount: p.contingencyAmount.toString(),
                totalActualRevenue: totalActualRevenue.toString(),
                totalActualOpex: totalActualOpex.toString(),
                createdAt: p.createdAt
            }
        })

        return NextResponse.json({ projects }, { status: 200 })

    } catch (error) {
        console.error('[INVESTOR_PROJECTS] Error:', error)
        return NextResponse.json({ message: 'Terjadi kesalahan' }, { status: 500 })
    }
}
