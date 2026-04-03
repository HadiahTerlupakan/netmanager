import { prisma } from '@/lib/prisma'
import type { PrismaClient, Prisma, Pelanggan, Settings } from '@prisma/client'

export class PelangganFinanceRepository {
    constructor(private client: PrismaClient = prisma) {}

    async findById(id: string): Promise<Pelanggan | null> {
        return this.client.pelanggan.findUnique({ where: { id } })
    }

    async findOverdueActiveCustomers(today: Date): Promise<Pelanggan[]> {
        return this.client.pelanggan.findMany({
            where: { status: 'AKTIF', autoIsolir: true, jatuhTempo: { lt: today } }
        })
    }

    async updateStatus(id: string, status: string): Promise<Pelanggan> {
        return this.client.pelanggan.update({
            where: { id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { status: status as any }
        })
    }

    async updateJatuhTempo(id: string, jatuhTempo: Date): Promise<Pelanggan> {
        return this.client.pelanggan.update({
            where: { id },
            data: { jatuhTempo }
        })
    }

    async findWithHargaPaket(id: string) {
        return this.client.pelanggan.findUnique({
            where: { id },
            include: { hargaPaket: true }
        })
    }

    async findEligibleForBilling(targetDay: number, batchSize: number, offset: number) {
        return this.client.$queryRaw`
            SELECT
                p.id, p.nama, p."jatuhTempo", p."userId", p."usePPN", p."hargaPaketId", p.tipe, p.status,
                h.name AS "paketName", h.harga AS "paketHarga",
                h."usePPN" AS "paketUsePPN", h."ppnPercentage" AS "paketPpnPercentage"
            FROM "Pelanggan" p
            INNER JOIN "HargaPaket" h ON p."hargaPaketId" = h.id
            WHERE (p.status = 'AKTIF' OR (p.status = 'ISOLIR' AND p.tipe = 'REGULER'))
              AND p."hargaPaketId" != ''
              AND EXTRACT(DAY FROM p."jatuhTempo") = ${targetDay}
            ORDER BY p.id ASC
            LIMIT ${batchSize} OFFSET ${offset}
        `
    }
}

export class MainSettingsRepository {
    constructor(private client: PrismaClient = prisma) {}

    async findByKey(key: string): Promise<Settings | null> {
        return this.client.settings.findFirst({ where: { key } })
    }

    async findManyByKeys(keys: string[]): Promise<Settings[]> {
        return this.client.settings.findMany({
            where: { key: { in: keys } }
        })
    }

    async findManyByKeyPattern(pattern: string): Promise<Settings[]> {
        return this.client.settings.findMany({
            where: { key: { contains: pattern, mode: 'insensitive' } }
        })
    }
}
