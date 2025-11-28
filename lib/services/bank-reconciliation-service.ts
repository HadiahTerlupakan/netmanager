// Bank Reconciliation Service - Auto-matching logic

import { PrismaClient, TagihanStatus } from '@prisma/client'

export interface MatchCandidate {
    type: 'TAGIHAN' | 'PENGELUARAN' | 'PEMASUKAN'
    id: string
    amount: bigint
    date: Date
    description: string
    confidence: number // 0.0 - 1.0
}

export class BankReconciliationService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Auto-match a bank statement with system records (Tagihan, Pengeluaran, Pemasukan)
     * Returns best match candidates with confidence scores
     */
    async findMatchCandidates(
        amount: bigint,
        transactionDate: Date,
        description: string,
        isCredit: boolean // true for money in, false for money out
    ): Promise<MatchCandidate[]> {
        const candidates: MatchCandidate[] = []

        // Create date range (±3 days for flexibility)
        const startDate = new Date(transactionDate)
        startDate.setDate(startDate.getDate() - 3)
        const endDate = new Date(transactionDate)
        endDate.setDate(endDate.getDate() + 3)

        if (isCredit) {
            // Money IN - match dengan Tagihan (payments)
            const tagihans = await this.prisma.tagihan.findMany({
                where: {
                    status: TagihanStatus.LUNAS,
                    tanggalBayar: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                include: {
                    pelanggan: true
                }
            })

            for (const tagihan of tagihans) {
                const tagihanAmount = typeof tagihan.total === 'bigint' ? tagihan.total : BigInt(tagihan.total)

                // Calculate confidence
                const amountMatch = tagihanAmount === amount ? 1.0 : 0.8
                const dateMatch = this.calculateDateProximity(transactionDate, tagihan.tanggalBayar!)
                const confidence = (amountMatch * 0.7 + dateMatch * 0.3)

                if (confidence >= 0.6) {
                    candidates.push({
                        type: 'TAGIHAN',
                        id: tagihan.id,
                        amount: tagihanAmount,
                        date: tagihan.tanggalBayar!,
                        description: `${tagihan.pelanggan.nama} - ${tagihan.noTagihan}`,
                        confidence
                    })
                }
            }

            // Money IN - also check Pemasukan (manual income)
            const pemasukans = await this.prisma.pemasukan.findMany({
                where: {
                    tanggal: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            })

            for (const pemasukan of pemasukans) {
                const pemasukanAmount = typeof pemasukan.jumlah === 'bigint' ? pemasukan.jumlah : BigInt(pemasukan.jumlah)

                const amountMatch = pemasukanAmount === amount ? 1.0 : 0.8
                const dateMatch = this.calculateDateProximity(transactionDate, pemasukan.tanggal)
                const confidence = (amountMatch * 0.7 + dateMatch * 0.3)

                if (confidence >= 0.6) {
                    candidates.push({
                        type: 'PEMASUKAN',
                        id: pemasukan.id,
                        amount: pemasukanAmount,
                        date: pemasukan.tanggal,
                        description: pemasukan.deskripsi,
                        confidence
                    })
                }
            }
        } else {
            // Money OUT - match dengan Pengeluaran
            const pengeluarans = await this.prisma.pengeluaran.findMany({
                where: {
                    tanggal: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            })

            for (const pengeluaran of pengeluarans) {
                const pengeluaranAmount = typeof pengeluaran.jumlah === 'bigint' ? pengeluaran.jumlah : BigInt(pengeluaran.jumlah)

                const amountMatch = pengeluaranAmount === amount ? 1.0 : 0.8
                const dateMatch = this.calculateDateProximity(transactionDate, pengeluaran.tanggal)
                const confidence = (amountMatch * 0.7 + dateMatch * 0.3)

                if (confidence >= 0.6) {
                    candidates.push({
                        type: 'PENGELUARAN',
                        id: pengeluaran.id,
                        amount: pengeluaranAmount,
                        date: pengeluaran.tanggal,
                        description: pengeluaran.deskripsi,
                        confidence
                    })
                }
            }
        }

        // Sort by confidence (highest first)
        return candidates.sort((a, b) => b.confidence - a.confidence)
    }

    /**
     * Create reconciliation match
     */
    async createMatch(
        bankStatementId: string,
        matchType: 'PAYMENT_IN' | 'PAYMENT_OUT',
        entityType: 'TAGIHAN' | 'PENGELUARAN' | 'PEMASUKAN',
        entityId: string,
        confidence: number,
        matchedBy?: string
    ) {
        // Create match record
        await this.prisma.reconciliationMatch.create({
            data: {
                bankStatementId,
                matchType,
                matchedEntityType: entityType,
                matchedEntityId: entityId,
                confidence,
                matchedBy: matchedBy || null
            }
        })

        // Mark bank statement as reconciled
        await this.prisma.bankStatement.update({
            where: { id: bankStatementId },
            data: {
                isReconciled: true,
                reconciledAt: new Date()
            }
        })
    }

    /**
     * Calculate date proximity score (0.0 - 1.0)
     * Same day = 1.0, 1 day diff = 0.9, 2 days = 0.8, 3 days = 0.7
     */
    private calculateDateProximity(date1: Date, date2: Date): number {
        const diffTime = Math.abs(date1.getTime() - date2.getTime())
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 1.0
        if (diffDays === 1) return 0.9
        if (diffDays === 2) return 0.8
        if (diffDays === 3) return 0.7
        return 0.5
    }
}
