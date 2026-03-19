import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { toStartOfDay } from '@/lib/utils/datetime'
import { apiError, ErrorCodes } from '@/lib/api-response'


const mixRadiusService = getMixRadiusService()

export async function GET(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const tenantId = payload.tenantId as string
        const userId = payload.id as string

        // Handle Mitra users - they are in a separate table
        if (payload.role === 'MITRA') {
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: userId },
                select: {
                    siteId: true,
                    mitraType: true,
                    targetHarian: true,
                    enableFeePelanggan: true,
                    mitraRateFeePelanggan: true,
                    mixradiusOwnerNames: true,
                    mitraWallet: { select: { balance: true } }
                }
            })

            if (!mitra) {
                return apiError('Mitra tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
            }

            const now = new Date()
            const today = new Date(now)
            today.setTime(toStartOfDay(today).getTime())
            const weekStart = new Date(now)
            const dayOfWeek = weekStart.getDay()
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            weekStart.setDate(weekStart.getDate() - diff)
            weekStart.setTime(toStartOfDay(weekStart).getTime())
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            monthStart.setTime(toStartOfDay(monthStart).getTime())

            // Mitra work orders are assigned via mitraId field in WorkOrderAssignments
            const workOrdersAssigned = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    tenantId,
                    workOrders: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] } }
                }
            })

            const woCompletedToday = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    tenantId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: today }
                    }
                }
            })

            const woCompletedWeek = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    tenantId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: weekStart }
                    }
                }
            })

            const woCompletedMonth = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    tenantId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: monthStart }
                    }
                }
            })

            let targetHarian = 0;
            let suksesClosingMonth = 0;
            let saldoKomisi = 0;
            let activeCustomers = 0;
            let totalFeePelanggan = 0;

            if (mitra.mitraType === 'MITRA_SALES') {
                targetHarian = mitra.targetHarian || 0;
                saldoKomisi = mitra.mitraWallet?.balance?.toNumber() || 0;

                suksesClosingMonth = await prisma.canvasing.count({
                    where: {
                        mitraId: userId,
                        status: 'APPROVED',
                        createdAt: { gte: monthStart },
                        tenantId
                    }
                })

                if (mitra.enableFeePelanggan) {
                    try {
                        const startStr = monthStart.toISOString().split('T')[0]
                        const endStr = today.toISOString().split('T')[0]

                        const incomeResult = await mixRadiusService.fetchIncomeByPeriod({ startDate: startStr, endDate: endStr, length: 100000 })
                        if (incomeResult && incomeResult.data && incomeResult.data.length > 0) {
                            const allowedOwners = new Set<string>()
                            if (mitra.mixradiusOwnerNames) {
                                mitra.mixradiusOwnerNames.forEach((o: string) => {
                                    const lower = o.toLowerCase().trim()
                                    allowedOwners.add(lower)
                                    allowedOwners.add(lower.split(/[—–-]/)[0].trim())
                                })
                            }

                            const filteredData = incomeResult.data.filter((item: { owner_name?: string }) => {
                                if (allowedOwners.size === 0) return true
                                if (!item.owner_name) return false
                                const itemOwner = item.owner_name.toLowerCase().trim()
                                const itemPrefix = itemOwner.split(/[—–-]/)[0].trim()
                                return allowedOwners.has(itemOwner) || allowedOwners.has(itemPrefix)
                            })

                            const uniqueMembers = new Set()
                            filteredData.forEach((r: { member_id?: string, invoice: string }) => {
                                const identifier = (r.member_id === '0' || !r.member_id) ? r.invoice : r.member_id
                                if (identifier) uniqueMembers.add(identifier)
                            })

                            activeCustomers = uniqueMembers.size
                            totalFeePelanggan = activeCustomers * (mitra.mitraRateFeePelanggan || 0)

                            console.log(`[Mobile API] MixRadius Fee Debug: start=${startStr}, end=${endStr}, expectedOwners=${JSON.stringify(mitra.mixradiusOwnerNames)}, fetched=${incomeResult.data.length}, filtered=${filteredData.length}, activeCustomers=${activeCustomers}`)
                        } else {
                            console.log(`[Mobile API] MixRadius Fee Debug: No data from MixRadius API for period ${startStr} to ${endStr}`)
                        }
                    } catch (err) {
                        console.error('[Mobile API] Error fetching MixRadius fee:', err)
                    }
                }

                // Add the un-withdrawn fee to their current virtual balance overview?
                // The web app handles it in MitraDetail view, just for display. 
                // We'll pass it to frontend, if they want to sum it up.
                saldoKomisi += totalFeePelanggan;
            }

            return NextResponse.json({
                workOrdersAssigned,
                workOrdersPending: 0, // Mitra don't see pending pool
                woCompletedToday,
                woCompletedWeek,
                woCompletedMonth,
                barangKeluarToday: 0,
                barangMasukToday: 0,
                // Extra payload for Sales Mode
                targetHarian,
                suksesClosingMonth,
                saldoKomisi,
                activeCustomers,
                enableFeePelanggan: mitra.enableFeePelanggan || false
            })
        }

        // Handle regular User (Karyawan)
        const user = await prisma.user.findFirst({
            where: { id: userId , tenantId },
            select: {
                siteId: true,
                departmentId: true,
                userSites: {
                    select: { siteId: true }
                }
            }
        })

        if (!user) {
            return apiError('User tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        const userSiteIds: string[] = [];
        if (user.userSites && user.userSites.length > 0) {
            userSiteIds.push(...user.userSites.map((us: { siteId: string }) => us.siteId));
        } else if (user.siteId) {
            userSiteIds.push(user.siteId);
        }

        const now = new Date()

        // Today start
        const today = new Date(now)
        today.setTime(toStartOfDay(today).getTime())

        // Week start (Monday)
        const weekStart = new Date(now)
        const dayOfWeek = weekStart.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(weekStart.getDate() - diff)
        weekStart.setTime(toStartOfDay(weekStart).getTime())

        // Month start
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        monthStart.setTime(toStartOfDay(monthStart).getTime())

        // Get work orders assigned to user (active)
        const workOrdersAssigned = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
                tenantId
            }
        })

        // Get pending work orders (available to take)
        // Same logic as /api/mobile/work-orders/available
        const workOrdersPending = await prisma.workOrders.count({
            where: {
                status: 'PENDING',
                assignedToId: null,
                tenantId,
                AND: [
                    user.departmentId
                        ? { OR: [{ departmentId: null }, { departmentId: user.departmentId }] }
                        : { departmentId: null },
                    userSiteIds.length > 0
                        ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
                        : { siteId: null }
                ]
            }
        })

        // WO completed TODAY by user (includes COMPLETED, VERIFIED, CLOSED)
        const woCompletedToday = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                completedAt: { gte: today },
                tenantId
            }
        })

        // WO completed THIS WEEK by user
        const woCompletedWeek = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                completedAt: { gte: weekStart },
                tenantId
            }
        })

        // WO completed THIS MONTH by user
        const woCompletedMonth = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                completedAt: { gte: monthStart },
                tenantId
            }
        })

        // Get barang keluar today by user
        const barangKeluarToday = await prisma.barangKeluar.count({
            where: {
                userId,
                tanggal: { gte: today },
                tenantId
            }
        })

        // Get barang masuk today by user
        const barangMasukToday = await prisma.barangMasuk.count({
            where: {
                userId,
                tanggal: { gte: today },
                tenantId
            }
        })

        // Ensure to fetch canvasingTarget and targetSchema from user
        const userDetails = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { canvasingTarget: true, targetSchema: true }
        })
        const canvasingTarget = userDetails?.canvasingTarget || 30
        const targetSchema = userDetails?.targetSchema || 'MONTHLY_RESET'

        // For internal Karyawan Sales, we need unclaimed canvasing progress vs target
        let unclaimedCanvasing = 0
        if (targetSchema === 'ACCUMULATED') {
            // Accumulated: Approved points that are not yet cashed out
            unclaimedCanvasing = await prisma.pointClaim.count({
                where: {
                    salesId: userId,
                    status: 'APPROVED',
                    isCashedOut: false,
                    tenantId
                }
            })
        } else {
            // Monthly Reset: Points achieved in the current month
            unclaimedCanvasing = await prisma.canvasing.count({
                where: {
                    salesId: userId,
                    status: 'APPROVED',
                    createdAt: {
                        gte: monthStart
                    },
                    tenantId
                }
            })
        }

        return NextResponse.json({
            workOrdersAssigned,
            workOrdersPending,
            woCompletedToday,
            woCompletedWeek,
            woCompletedMonth,
            barangKeluarToday,
            barangMasukToday,
            unclaimedCanvasing,
            canvasingTarget,
            targetSchema
        })
    } catch (error) {
        console.error('Error fetching mobile dashboard stats:', error)
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
