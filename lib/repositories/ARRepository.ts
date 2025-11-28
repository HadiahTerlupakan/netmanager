import { PrismaClient, TagihanStatus } from '@prisma/client'
import type { IARRepository, OutstandingInvoice, AgingReport } from './IARRepository'

export class ARRepository implements IARRepository {
    constructor(private prisma: PrismaClient) { }

    async findOutstanding(filters?: {
        area?: string
        paketId?: string
        agingBucket?: string
        limit?: number
        offset?: number
    }): Promise<{ data: OutstandingInvoice[]; total: number }> {
        const where: any = {
            status: {
                in: [TagihanStatus.BELUM_LUNAS, TagihanStatus.TERLAMBAT]
            }
        }

        // Build where clause based on filters
        if (filters?.area) {
            where.pelanggan = {
                ...where.pelanggan,
                kecamatan: filters.area // or kabupatenKota, tergantung definisi "area"
            }
        }

        if (filters?.paketId) {
            where.pelanggan = {
                ...where.pelanggan,
                hargaPaketId: filters.paketId
            }
        }

        const tagihans = await this.prisma.tagihan.findMany({
            where,
            include: {
                pelanggan: {
                    include: {
                        hargaPaket: true
                    }
                }
            },
            orderBy: {
                jatuhTempo: 'asc'
            },
            skip: filters?.offset || 0,
            take: filters?.limit || 100
        })

        const total = await this.prisma.tagihan.count({ where })

        const now = new Date()
        const data: OutstandingInvoice[] = tagihans.map((tagihan) => {
            const jatuhTempo = new Date(tagihan.jatuhTempo)
            const diffTime = now.getTime() - jatuhTempo.getTime()
            const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24))

            let agingBucket: 'CURRENT' | 'OVERDUE_30' | 'OVERDUE_60' | 'OVERDUE_90_PLUS'
            if (daysOverdue <= 0) {
                agingBucket = 'CURRENT'
            } else if (daysOverdue <= 30) {
                agingBucket = 'OVERDUE_30'
            } else if (daysOverdue <= 60) {
                agingBucket = 'OVERDUE_60'
            } else {
                agingBucket = 'OVERDUE_90_PLUS'
            }

            return {
                id: tagihan.id,
                pelangganId: tagihan.pelangganId,
                pelangganNama: tagihan.pelanggan.nama,
                pelangganEmail: tagihan.pelanggan.email,
                pelangganNoTelp: tagihan.pelanggan.noTelp,
                noTagihan: tagihan.noTagihan,
                periodeBulan: tagihan.periodeBulan,
                periodeTahun: tagihan.periodeTahun,
                total: typeof tagihan.total === 'bigint' ? tagihan.total : BigInt(tagihan.total),
                jatuhTempo: tagihan.jatuhTempo,
                daysOverdue: Math.max(0, daysOverdue),
                agingBucket,
                paketName: tagihan.pelanggan.hargaPaket.name,
                area: tagihan.pelanggan.kecamatan
            }
        })

        // Filter by aging bucket if specified
        const filteredData = filters?.agingBucket
            ? data.filter((item) => item.agingBucket === filters.agingBucket)
            : data

        return {
            data: filteredData,
            total
        }
    }

    async calculateAgingReport(): Promise<AgingReport> {
        const outstandingTagihans = await this.prisma.tagihan.findMany({
            where: {
                status: {
                    in: [TagihanStatus.BELUM_LUNAS, TagihanStatus.TERLAMBAT]
                }
            },
            select: {
                total: true,
                jatuhTempo: true,
                pelangganId: true
            }
        })

        const now = new Date()
        let current = BigInt(0)
        let overdue30 = BigInt(0)
        let overdue60 = BigInt(0)
        let overdue90 = BigInt(0)
        const uniqueCustomers = new Set<string>()

        for (const tagihan of outstandingTagihans) {
            const jatuhTempo = new Date(tagihan.jatuhTempo)
            const diffTime = now.getTime() - jatuhTempo.getTime()
            const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24))

            const amount = typeof tagihan.total === 'bigint' ? tagihan.total : BigInt(tagihan.total)

            if (daysOverdue <= 0) {
                current += amount
            } else if (daysOverdue <= 30) {
                overdue30 += amount
            } else if (daysOverdue <= 60) {
                overdue60 += amount
            } else {
                overdue90 += amount
            }

            uniqueCustomers.add(tagihan.pelangganId)
        }

        return {
            current,
            overdue30,
            overdue60,
            overdue90,
            totalOutstanding: current + overdue30 + overdue60 + overdue90,
            totalCustomers: uniqueCustomers.size
        }
    }

    async createAgingSnapshot(): Promise<{ id: string }> {
        const aging = await this.calculateAgingReport()

        const snapshot = await this.prisma.aRAgingSnapshot.create({
            data: {
                current: aging.current,
                overdue30: aging.overdue30,
                overdue60: aging.overdue60,
                overdue90: aging.overdue90,
                totalOutstanding: aging.totalOutstanding,
                totalCustomers: aging.totalCustomers
            }
        })

        return { id: snapshot.id }
    }

    async findAgingSnapshots(limit = 30): Promise<any[]> {
        return this.prisma.aRAgingSnapshot.findMany({
            orderBy: {
                snapshotDate: 'desc'
            },
            take: limit
        })
    }

    async calculateCollectionRate(
        month: number,
        year: number
    ): Promise<{
        totalInvoices: number
        paidOnTime: number
        paidLate: number
        unpaid: number
        collectionRate: number
        avgDaysToPay: number
    }> {
        const tagihans = await this.prisma.tagihan.findMany({
            where: {
                periodeBulan: month,
                periodeTahun: year
            }
        })

        let paidOnTime = 0
        let paidLate = 0
        let unpaid = 0
        let totalDaysToPay = 0
        let paidCount = 0

        for (const tagihan of tagihans) {
            if (tagihan.status === TagihanStatus.LUNAS && tagihan.tanggalBayar) {
                const jatuhTempo = new Date(tagihan.jatuhTempo)
                const tanggalBayar = new Date(tagihan.tanggalBayar)
                const diffTime = tanggalBayar.getTime() - jatuhTempo.getTime()
                const daysToPay = Math.floor(diffTime / (1000 * 60 * 60 * 24))

                if (daysToPay <= 0) {
                    paidOnTime++
                } else {
                    paidLate++
                }

                totalDaysToPay += Math.abs(daysToPay)
                paidCount++
            } else {
                unpaid++
            }
        }

        const totalInvoices = tagihans.length
        const collectionRate = totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0
        const avgDaysToPay = paidCount > 0 ? totalDaysToPay / paidCount : 0

        return {
            totalInvoices,
            paidOnTime,
            paidLate,
            unpaid,
            collectionRate,
            avgDaysToPay
        }
    }
}
