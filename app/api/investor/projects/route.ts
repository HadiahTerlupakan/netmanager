import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'

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
                        site: { select: { name: true } },
                        mixRadiusInvestorSite: { select: { name: true, owners: true } }
                    }
                }
            },
            orderBy: {
                rabProject: {
                    createdAt: 'desc'
                }
            }
        })

        const siteIds = [...new Set(rabInvestors.map(ri => ri.rabProject.siteId).filter(Boolean))] as string[]
        const mixRadiusOwners = [...new Set(rabInvestors
            .filter(ri => ri.rabProject.mixRadiusInvestorSiteId && ri.rabProject.mixRadiusInvestorSite)
            .flatMap(ri => ri.rabProject.mixRadiusInvestorSite?.owners || []))]

        let internalCustomers: {
            siteId: string | null;
            status: import('@prisma/client').Status;
            idPelanggan: string;
            jatuhTempo: Date;
            hargaPaket: { harga: import('@prisma/client').Prisma.Decimal | number | bigint | string } | null
        }[] = []

        if (siteIds.length > 0) {
            internalCustomers = await prisma.pelanggan.findMany({
                where: { siteId: { in: siteIds } },
                select: { siteId: true, status: true, idPelanggan: true, jatuhTempo: true, hargaPaket: { select: { harga: true } } }
            })
        }

        let mixRadiusCustomers: import('@/modules/integrations/services/MixRadiusService').MixRadiusCustomer[] = []
        if (mixRadiusOwners.length > 0) {
            try {
                const service = getMixRadiusService()
                const response = await service.fetchCustomersPPP({
                    start: 0,
                    length: 10000,
                    forceRefresh: false
                })
                mixRadiusCustomers = response.data || []
            } catch (e) {
                console.error("Error fetching MixRadius metrics:", e)
            }
        }

        const projects = rabInvestors.map(ri => {
            const p = ri.rabProject

            let totalActualRevenue = 0;
            let totalActualOpex = 0;

            // 1. History
            p.actualAchievements.forEach(ach => {
                totalActualRevenue += Number(ach.actualRevenue);
                totalActualOpex += Number(ach.actualOpex || 0);
            });

            // 2. Real-time dynamic active month estimation
            const now = new Date()

            if (p.siteId && !p.mixRadiusInvestorSiteId) {
                const payingInternal = internalCustomers.filter(c => c.siteId === p.siteId && c.status === 'AKTIF' && new Date(c.jatuhTempo) > now)
                totalActualRevenue += payingInternal.reduce((acc, c) => acc + Number(c.hargaPaket?.harga || 0), 0)

            } else if (p.mixRadiusInvestorSiteId && p.mixRadiusInvestorSite) {
                const owners = p.mixRadiusInvestorSite.owners || []
                const activeMixRadius = mixRadiusCustomers.filter(c => {
                    const ownerLower = (c.owner_name || '').toLowerCase().trim()
                    const isOwnerMatch = owners.some((allowed: unknown) => {
                        const allowedLower = String(allowed).toLowerCase().trim()
                        const allowedPrefix = allowedLower.split(/[—–-]/)[0].trim()
                        return ownerLower === allowedLower || ownerLower === allowedPrefix
                    })

                    if (!isOwnerMatch) return false

                    if (c.auth_status === 'Active' || c.auth_status === 'Enabled-Users') {
                        if (c.expired_on) {
                            const expDate = new Date(c.expired_on as string)
                            if (!isNaN(expDate.getTime()) && expDate < now) return false
                        }
                        return true
                    }
                    return false
                })
                totalActualRevenue += activeMixRadius.reduce((acc, c) => acc + Number(c.total || 0), 0)
            }

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
