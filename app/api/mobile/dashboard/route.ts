import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        // 1. Verify Token
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 })
        }
        const payload = await verifyMobileToken(token)

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const userId = payload.id as string

        // Handle Mitra users - they are in a separate table
        if (payload.role === 'MITRA') {
            const mitra = await prisma.mitra.findUnique({
                where: { id: userId },
                select: {
                    siteId: true,
                    mitraType: true,
                    targetHarian: true,
                    mitraWallet: { select: { balance: true } }
                }
            })

            if (!mitra) {
                return NextResponse.json({ error: 'Mitra tidak ditemukan' }, { status: 404 })
            }

            const now = new Date()
            const today = new Date(now)
            today.setHours(0, 0, 0, 0)
            const weekStart = new Date(now)
            const dayOfWeek = weekStart.getDay()
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            weekStart.setDate(weekStart.getDate() - diff)
            weekStart.setHours(0, 0, 0, 0)
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            monthStart.setHours(0, 0, 0, 0)

            // Mitra work orders are assigned via mitraId field in WorkOrderAssignments
            const workOrdersAssigned = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    workOrders: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] } }
                }
            })

            const woCompletedToday = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: today }
                    }
                }
            })

            const woCompletedWeek = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: weekStart }
                    }
                }
            })

            const woCompletedMonth = await prisma.workOrderAssignments.count({
                where: {
                    mitraId: userId,
                    workOrders: {
                        status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                        completedAt: { gte: monthStart }
                    }
                }
            })

            // Additional Stats specifically for MITRA_SALES
            let targetHarian = 0;
            let suksesClosingMonth = 0;
            let saldoKomisi = 0;

            if (mitra.mitraType === 'MITRA_SALES') {
                targetHarian = mitra.targetHarian || 0;
                saldoKomisi = mitra.mitraWallet?.balance || 0;

                suksesClosingMonth = await prisma.canvasing.count({
                    where: {
                        mitraId: userId,
                        status: 'APPROVED',
                        createdAt: { gte: monthStart }
                    }
                })
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
                saldoKomisi
            })
        }

        // Handle regular User (Karyawan)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                siteId: true,
                departmentId: true,
                userSites: {
                    select: { siteId: true }
                }
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
        }

        const userSiteIds: string[] = [];
        if (user.userSites && user.userSites.length > 0) {
            userSiteIds.push(...user.userSites.map(us => us.siteId));
        } else if (user.siteId) {
            userSiteIds.push(user.siteId);
        }

        const now = new Date()

        // Today start
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        // Week start (Monday)
        const weekStart = new Date(now)
        const dayOfWeek = weekStart.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(weekStart.getDate() - diff)
        weekStart.setHours(0, 0, 0, 0)

        // Month start
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        monthStart.setHours(0, 0, 0, 0)

        // Get work orders assigned to user (active)
        const workOrdersAssigned = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] }
            }
        })

        // Get pending work orders (available to take)
        // Same logic as /api/mobile/work-orders/available
        const workOrdersPending = await prisma.workOrders.count({
            where: {
                status: 'PENDING',
                assignedToId: null,
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
                completedAt: { gte: today }
            }
        })

        // WO completed THIS WEEK by user
        const woCompletedWeek = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                completedAt: { gte: weekStart }
            }
        })

        // WO completed THIS MONTH by user
        const woCompletedMonth = await prisma.workOrders.count({
            where: {
                assignedToId: userId,
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
                completedAt: { gte: monthStart }
            }
        })

        // Get barang keluar today by user
        const barangKeluarToday = await prisma.barangKeluar.count({
            where: {
                userId,
                tanggal: { gte: today }
            }
        })

        // Get barang masuk today by user
        const barangMasukToday = await prisma.barangMasuk.count({
            where: {
                userId,
                tanggal: { gte: today }
            }
        })

        return NextResponse.json({
            workOrdersAssigned,
            workOrdersPending,
            woCompletedToday,
            woCompletedWeek,
            woCompletedMonth,
            barangKeluarToday,
            barangMasukToday
        })
    } catch (error) {
        console.error('Error fetching mobile dashboard stats:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
