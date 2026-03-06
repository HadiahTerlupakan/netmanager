import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing'
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rabInvestors = await (prisma as any).rabInvestor.findMany({
            where: { investorId },
            include: {
                rabProject: {
                    include: {
                        actualAchievements: true,
                        items: true,
                    }
                }
            }
        })

        // Calculate metrics
        let totalInvestment = BigInt(0)
        let totalProjectedRevenue = BigInt(0)
        let totalActualRevenue = BigInt(0)
        const activeProjectsCount = rabInvestors.length

        // Compile site IDs to measure subscriber growth accurately (Internal APP Site)
        const siteIds = [...new Set(rabInvestors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ri: any) => ri.rabProject.siteId && !ri.rabProject.mixRadiusInvestorSiteId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((ri: any) => ri.rabProject.siteId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((id: any): id is string => id !== null))] as string[]

        // Fetch MixRadiusInvestorSite details from billing DB
        const investorSiteIds = [...new Set(rabInvestors.map((ri: any) => ri.rabProject.mixRadiusInvestorSiteId).filter(Boolean))] as string[]
        const investorSites = investorSiteIds.length > 0
            ? await prismaBilling.mixRadiusInvestorSite.findMany({
                where: { id: { in: investorSiteIds } }
            })
            : []
        const investorSiteMap = new Map(investorSites.map(is => [is.id, is]))

        // Compile MixRadius owners
        const mixRadiusOwners = [...new Set(rabInvestors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ri: any) => ri.rabProject.mixRadiusInvestorSiteId && investorSiteMap.has(ri.rabProject.mixRadiusInvestorSiteId))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .flatMap((ri: any) => investorSiteMap.get(ri.rabProject.mixRadiusInvestorSiteId)?.owners || []))]

        let totalSubscribers = 0
        let activeSubscribers = 0
        let payingSubscribers = 0

        let internalCustomers: {
            siteId: string | null;
            status: import('@prisma/client').Status;
            idPelanggan: string;
            jatuhTempo: Date;
            hargaPaket: { harga: import('@prisma/client').Prisma.Decimal | number | bigint | string } | null
        }[] = []

        // INTERNAL BILLING
        if (siteIds.length > 0) {
            internalCustomers = await prisma.pelanggan.findMany({
                where: { siteId: { in: siteIds } },
                select: { siteId: true, status: true, idPelanggan: true, jatuhTempo: true, hargaPaket: { select: { harga: true } } }
            })

            totalSubscribers += internalCustomers.length
            activeSubscribers += internalCustomers.filter(c => c.status === 'AKTIF').length

            const now = new Date()
            payingSubscribers += internalCustomers.filter(c => c.status === 'AKTIF' && c.jatuhTempo > now).length
        }

        let mixRadiusCustomers: import('@/modules/integrations/services/MixRadiusService').MixRadiusCustomer[] = []
        // MIXRADIUS BILLING
        if (mixRadiusOwners.length > 0) {
            try {
                const service = getMixRadiusService()

                // Fetch all customers (we don't pass owner map initially because the service filters based on active configs, we map everything matching the list)
                const response = await service.fetchCustomersPPP({
                    start: 0,
                    length: 10000,
                    forceRefresh: false
                })

                mixRadiusCustomers = response.data || []

                // Filter by our specific mixRadiusOwners mapping in rabProject
                const matchingCustomers = mixRadiusCustomers.filter(c => {
                    if (!c.owner_name) return false
                    const ownerLower = c.owner_name.toLowerCase().trim()
                    return mixRadiusOwners.some((allowed: unknown) => {
                        const allowedStr = String(allowed)
                        const allowedLower = allowedStr.toLowerCase().trim()
                        const allowedPrefix = allowedLower.split(/[—–-]/)[0].trim()
                        return ownerLower === allowedLower || ownerLower === allowedPrefix
                    })
                })

                totalSubscribers += matchingCustomers.length

                // Identify active based on their auth_status / expiration
                const now = new Date()
                const activeCustomers = matchingCustomers.filter(c => {
                    // Filter based on MixRadiusService logic for "Active" vs "Isolir"
                    // Assume 'Enabled-Users' and not expired is Active
                    if (c.auth_status === 'Active' || c.auth_status === 'Enabled-Users') {
                        if (c.expired_on) {
                            const expDate = new Date(c.expired_on as string)
                            if (!isNaN(expDate.getTime()) && expDate < now) return false // Expired
                        }
                        return true
                    }
                    return false
                })

                activeSubscribers += activeCustomers.length
                payingSubscribers += activeCustomers.length // Treat all active as paying

            } catch (e) {
                console.error("Error fetching MixRadius metrics:", e)
            }
        }


        for (const ri of rabInvestors) {
            totalInvestment += BigInt(ri.investmentAmount.toString())

            const netProjected = Math.max(0, Number(ri.rabProject.projectedRevenue) - Number(ri.rabProject.projectedOpex) - Number(ri.rabProject.contingencyAmount))
            const projRev = netProjected * (Number(ri.profitSharePercent) / 100)
            totalProjectedRevenue += BigInt(Math.floor(projRev))

            // Estimasi pendapatan aktif real-time berjalan untuk bulan ini (Dual Biling)
            let currentActualRevenue = 0
            const now = new Date()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((ri.rabProject as any).siteId && !(ri.rabProject as any).mixRadiusInvestorSiteId) {
                // Internal Billing
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payingInternal = internalCustomers.filter(c => (c as any).siteId === (ri.rabProject as any).siteId && c.status === 'AKTIF' && new Date(c.jatuhTempo) > now)
                currentActualRevenue = payingInternal.reduce((acc, c) => acc + Number(c.hargaPaket?.harga || 0), 0)

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } else if ((ri.rabProject as any).mixRadiusInvestorSiteId && investorSiteMap.has((ri.rabProject as any).mixRadiusInvestorSiteId)) {
                // MixRadius API Billing
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const owners = investorSiteMap.get((ri.rabProject as any).mixRadiusInvestorSiteId)?.owners || []
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
                currentActualRevenue = activeMixRadius.reduce((acc, c) => acc + Number(c.total || 0), 0)
            }

            // Tambahkan porsi profit investor dari pendapatan aktif berjalan ini
            const netCurrentActual = Math.max(0, currentActualRevenue - Number(ri.rabProject.projectedOpex || 0))
            const actCurrentRev = netCurrentActual * (Number(ri.profitSharePercent) / 100)
            totalActualRevenue += BigInt(Math.floor(actCurrentRev))

            // Tambahkan juga riwayat actualAchievements sebelumnya (jika ada)

            for (const ach of ri.rabProject.actualAchievements) {
                const netActual = Math.max(0, Number(ach.actualRevenue) - Number(ach.actualOpex || 0))
                const actRev = netActual * (Number(ri.profitSharePercent) / 100)
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
