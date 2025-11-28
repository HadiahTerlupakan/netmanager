// MRR/ARR Calculation Service

import { PrismaClient, TagihanStatus } from '@prisma/client'
import type { Pelanggan, Tagihan } from '@prisma/client'

export interface MRRMetrics {
    totalMRR: bigint
    totalARR: bigint
    activeCustomers: number
    arpu: number // Average Revenue Per User
    movements: {
        newMRR: bigint
        expansionMRR: bigint
        contractionMRR: bigint
        churnMRR: bigint
        reactivationMRR: bigint
    }
}

export interface RevenueBreakdown {
    byPackage: Array<{ paketName: string; mrr: bigint; count: number }>
    byArea: Array<{ area: string; mrr: bigint; count: number }>
}

export class MRRService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Calculate current MRR from active customers
     */
    async calculateCurrentMRR(): Promise<MRRMetrics> {
        // Get all active customers (status AKTIF)
        const activeCustomers = await this.prisma.pelanggan.findMany({
            where: {
                status: 'AKTIF'
            },
            include: {
                hargaPaket: true
            }
        })

        let totalMRR = BigInt(0)

        for (const customer of activeCustomers) {
            // Base MRR from paket harga
            const paketHarga = typeof customer.hargaPaket.harga === 'bigint'
                ? customer.hargaPaket.harga
                : BigInt(customer.hargaPaket.harga)

            totalMRR += paketHarga
        }

        const arpu = activeCustomers.length > 0
            ? Number(totalMRR) / activeCustomers.length
            : 0

        return {
            totalMRR,
            totalARR: totalMRR * BigInt(12), // ARR = MRR × 12
            activeCustomers: activeCustomers.length,
            arpu: Math.round(arpu),
            movements: {
                newMRR: BigInt(0),
                expansionMRR: BigInt(0),
                contractionMRR: BigInt(0),
                churnMRR: BigInt(0),
                reactivationMRR: BigInt(0)
            }
        }
    }

    /**
     * Calculate MRR movement for a specific month
     */
    async calculateMRRMovement(month: number, year: number): Promise<{
        newMRR: bigint
        expansionMRR: bigint
        contractionMRR: bigint
        churnMRR: bigint
        reactivationMRR: bigint
    }> {
        // Get movements from database
        const movements = await this.prisma.mRRMovement.findMany({
            where: {
                month,
                year
            }
        })

        let newMRR = BigInt(0)
        let expansionMRR = BigInt(0)
        let contractionMRR = BigInt(0)
        let churnMRR = BigInt(0)
        let reactivationMRR = BigInt(0)

        for (const movement of movements) {
            const amount = typeof movement.amount === 'bigint' ? movement.amount : BigInt(movement.amount)

            switch (movement.movementType) {
                case 'NEW':
                    newMRR += amount
                    break
                case 'EXPANSION':
                    expansionMRR += amount
                    break
                case 'CONTRACTION':
                    contractionMRR += amount
                    break
                case 'CHURN':
                    churnMRR += amount
                    break
                case 'REACTIVATION':
                    reactivationMRR += amount
                    break
            }
        }

        return {
            newMRR,
            expansionMRR,
            contractionMRR,
            churnMRR,
            reactivationMRR
        }
    }

    /**
     * Track MRR changes by comparing month-over-month
     */
    async trackMRRChanges(currentMonth: number, currentYear: number): Promise<void> {
        // Get previous month
        let prevMonth = currentMonth - 1
        let prevYear = currentYear
        if (prevMonth === 0) {
            prevMonth = 12
            prevYear -= 1
        }

        // Get customers from current and previous month
        const currentCustomers = await this.prisma.pelanggan.findMany({
            where: {
                status: 'AKTIF',
                createdAt: {
                    lte: new Date(currentYear, currentMonth, 0) // End of current month
                }
            },
            include: {
                hargaPaket: true
            }
        })

        const prevCustomers = await this.prisma.pelanggan.findMany({
            where: {
                status: 'AKTIF',
                createdAt: {
                    lte: new Date(prevYear, prevMonth, 0) // End of previous month
                }
            },
            include: {
                hargaPaket: true
            }
        })

        const prevCustomerMap = new Map(prevCustomers.map(c => [c.id, c]))
        const currentCustomerMap = new Map(currentCustomers.map(c => [c.id, c]))

        // Track movements
        for (const customer of currentCustomers) {
            const paketHarga = typeof customer.hargaPaket.harga === 'bigint'
                ? customer.hargaPaket.harga
                : BigInt(customer.hargaPaket.harga)

            if (!prevCustomerMap.has(customer.id)) {
                // New customer
                await this.prisma.mRRMovement.create({
                    data: {
                        month: currentMonth,
                        year: currentYear,
                        movementType: 'NEW',
                        pelangganId: customer.id,
                        amount: paketHarga,
                        description: `New customer: ${customer.nama}`
                    }
                })
            } else {
                // Check for expansion/contraction
                const prevCustomer = prevCustomerMap.get(customer.id)!
                const prevHarga = typeof prevCustomer.hargaPaket.harga === 'bigint'
                    ? prevCustomer.hargaPaket.harga
                    : BigInt(prevCustomer.hargaPaket.harga)

                if (paketHarga > prevHarga) {
                    await this.prisma.mRRMovement.create({
                        data: {
                            month: currentMonth,
                            year: currentYear,
                            movementType: 'EXPANSION',
                            pelangganId: customer.id,
                            amount: paketHarga - prevHarga,
                            description: `Upgrade: ${customer.nama}`
                        }
                    })
                } else if (paketHarga < prevHarga) {
                    await this.prisma.mRRMovement.create({
                        data: {
                            month: currentMonth,
                            year: currentYear,
                            movementType: 'CONTRACTION',
                            pelangganId: customer.id,
                            amount: prevHarga - paketHarga,
                            description: `Downgrade: ${customer.nama}`
                        }
                    })
                }
            }
        }

        // Track churned customers
        for (const prevCustomer of prevCustomers) {
            if (!currentCustomerMap.has(prevCustomer.id)) {
                const prevHarga = typeof prevCustomer.hargaPaket.harga === 'bigint'
                    ? prevCustomer.hargaPaket.harga
                    : BigInt(prevCustomer.hargaPaket.harga)

                await this.prisma.mRRMovement.create({
                    data: {
                        month: currentMonth,
                        year: currentYear,
                        movementType: 'CHURN',
                        pelangganId: prevCustomer.id,
                        amount: prevHarga,
                        description: `Churned: ${prevCustomer.nama}`
                    }
                })
            }
        }
    }

    /**
     * Create revenue snapshot for historical tracking
     */
    async createRevenueSnapshot(date: Date = new Date()): Promise<{ id: string }> {
        const metrics = await this.calculateCurrentMRR()
        const month = date.getMonth() + 1
        const year = date.getFullYear()
        const movements = await this.calculateMRRMovement(month, year)

        // Count new and churned customers this month
        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0)

        const newCustomers = await this.prisma.pelanggan.count({
            where: {
                createdAt: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        })

        const churnedCustomers = await this.prisma.pelanggan.count({
            where: {
                status: 'NONAKTIF',
                updatedAt: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        })

        const snapshot = await this.prisma.revenueSnapshot.create({
            data: {
                snapshotDate: date,
                snapshotType: 'MONTHLY',
                totalMRR: metrics.totalMRR,
                totalARR: metrics.totalARR,
                newMRR: movements.newMRR,
                expansionMRR: movements.expansionMRR,
                contractionMRR: movements.contractionMRR,
                churnMRR: movements.churnMRR,
                reactivationMRR: movements.reactivationMRR,
                activeCustomers: metrics.activeCustomers,
                newCustomers,
                churnedCustomers,
                arpu: metrics.arpu
            }
        })

        return { id: snapshot.id }
    }

    /**
     * Get revenue breakdown by package and area
     */
    async getRevenueBreakdown(): Promise<RevenueBreakdown> {
        const activeCustomers = await this.prisma.pelanggan.findMany({
            where: {
                status: 'AKTIF'
            },
            include: {
                hargaPaket: true
            }
        })

        // Group by package
        const packageMap = new Map<string, { mrr: bigint; count: number }>()
        const areaMap = new Map<string, { mrr: bigint; count: number }>()

        for (const customer of activeCustomers) {
            const harga = typeof customer.hargaPaket.harga === 'bigint'
                ? customer.hargaPaket.harga
                : BigInt(customer.hargaPaket.harga)

            // By package
            const paketName = customer.hargaPaket.name
            const existing = packageMap.get(paketName) || { mrr: BigInt(0), count: 0 }
            packageMap.set(paketName, {
                mrr: existing.mrr + harga,
                count: existing.count + 1
            })

            // By area
            const area = customer.kecamatan || 'Unknown'
            const existingArea = areaMap.get(area) || { mrr: BigInt(0), count: 0 }
            areaMap.set(area, {
                mrr: existingArea.mrr + harga,
                count: existingArea.count + 1
            })
        }

        return {
            byPackage: Array.from(packageMap.entries()).map(([name, data]) => ({
                paketName: name,
                mrr: data.mrr,
                count: data.count
            })),
            byArea: Array.from(areaMap.entries()).map(([name, data]) => ({
                area: name,
                mrr: data.mrr,
                count: data.count
            }))
        }
    }

    /**
     * Get revenue snapshots for trending
     */
    async getRevenueSnapshots(limit = 12): Promise<any[]> {
        return this.prisma.revenueSnapshot.findMany({
            where: {
                snapshotType: 'MONTHLY'
            },
            orderBy: {
                snapshotDate: 'desc'
            },
            take: limit
        })
    }
}
