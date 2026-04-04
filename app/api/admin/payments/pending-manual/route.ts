import { NextResponse } from 'next/server'
import { prismaBilling } from '@/modules/database'
import { prisma } from '@/modules/database'
import { ensureAdminAccess } from '@/lib/server-auth'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


export async function GET(request: Request) {
    try {
        await ensureAdminAccess()

        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const siteId = searchParams.get('siteId')
        const status = searchParams.get('status')

        const whereClause: Record<string, unknown> = {
            receiptUrl: {
                not: null
            }
        }

        if (startDate && endDate) {
            const start = new Date(startDate)
            start.setTime(toStartOfDay(start).getTime())
            const end = new Date(endDate)
            end.setTime(toEndOfDay(end).getTime())
            whereClause.createdAt = {
                gte: start,
                lte: end
            }
        }

        if (status) {
            if (status === 'PENDING') {
                whereClause.gatewayStatus = 'PENDING'
            } else if (status === 'APPROVED') {
                whereClause.gatewayStatus = { in: ['SUCCESS', 'PAID'] }
            } else if (status === 'REJECTED') {
                whereClause.gatewayStatus = { in: ['FAILED', 'CANCELLED'] }
            }
        }

        if (siteId) {
            const pelanggans = await prisma.pelanggan.findMany({
                where: { siteId },
                select: { id: true }
            })
            whereClause.pelangganId = { in: pelanggans.map(p => p.id) }
        }

        // Fetch payments that have a receiptUrl (manual payments)
        const pendingPayments = await prismaBilling.payment.findMany({
            where: whereClause,
            include: {
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        pelangganId: true,
                        totalAmount: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 500 // Limit to avoid massive load
        })

        // Fetch customer info from main prisma
        const pelangganIds = Array.from(new Set(pendingPayments.map(p => p.pelangganId)))

        let pelangganMap: Record<string, string> = {}
        if (pelangganIds.length > 0) {
            const pelangganData = await prisma.pelanggan.findMany({
                where: {
                    id: { in: pelangganIds }
                },
                select: {
                    id: true,
                    nama: true
                }
            })

            pelangganMap = pelangganData.reduce((acc, curr) => {
                acc[curr.id] = curr.nama
                return acc
            }, {} as Record<string, string>)
        }

        const serialized = pendingPayments.map(p => ({
            ...p,
            amount: p.amount.toString(),
            invoice: p.invoice ? {
                ...p.invoice,
                totalAmount: p.invoice.totalAmount.toString()
            } : null,
            customerName: pelangganMap[p.pelangganId] || 'Pelanggan Tidak Diketahui'
        }))

        return NextResponse.json({
            success: true,
            data: serialized
        })

    } catch (e) {
        const error = e as Error
        console.error('Error fetching pending manual payments:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
