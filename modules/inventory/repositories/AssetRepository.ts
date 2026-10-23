import { PrismaClient, Prisma, AssetStatus } from '@prisma/client'
import type { Asset, AssetDepreciationLog, Barang } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AssetWithRelations = Asset & {
    barang: Barang
    user: { id: string; name: string | null; email: string | null } | null
    depreciationLogs: AssetDepreciationLog[]
}

export interface CreateAssetInput {
    barangId: string
    kodeAsset: string
    purchaseDate: Date
    purchasePrice: number
    usefulLife: number // months
    residualValue?: number
    status?: AssetStatus
    location?: string
    assignedTo?: string
}

export interface UpdateAssetInput {
    kodeAsset?: string
    status?: AssetStatus
    location?: string
    assignedTo?: string
    currentValue?: number
}

export class AssetRepository {
    private db: PrismaClient

    constructor() {
        this.db = prisma
    }

    async createAsset(data: CreateAssetInput): Promise<Asset> {
        return this.db.asset.create({
            data: {
                id: crypto.randomUUID(),
                barangId: data.barangId,
                kodeAsset: data.kodeAsset,
                purchaseDate: data.purchaseDate,
                purchasePrice: data.purchasePrice,
                currentValue: data.purchasePrice, // Initial value = purchase price
                residualValue: data.residualValue || 0,
                usefulLife: data.usefulLife,
                status: data.status || 'ACTIVE',
                location: data.location ?? null,
                assignedTo: data.assignedTo ?? null
            }
        })
    }

    async createManyAssets(inputs: CreateAssetInput[]): Promise<number> {
        const result = await this.db.asset.createMany({
            data: inputs.map(data => ({
                id: crypto.randomUUID(),
                barangId: data.barangId,
                kodeAsset: data.kodeAsset,
                purchaseDate: data.purchaseDate,
                purchasePrice: data.purchasePrice,
                currentValue: data.purchasePrice,
                residualValue: data.residualValue || 0,
                usefulLife: data.usefulLife,
                status: data.status || 'ACTIVE',
                location: data.location ?? null,
                assignedTo: data.assignedTo ?? null
            }))
        })
        return result.count
    }

    async findAssetById(id: string): Promise<AssetWithRelations | null> {
        return this.db.asset.findUnique({
            where: { id },
            include: {
                barang: true,
                user: { select: { id: true, name: true, email: true } },
                depreciationLogs: {
                    orderBy: { date: 'desc' }
                }
            }
        })
    }

    async updateAsset(id: string, data: UpdateAssetInput): Promise<Asset> {
        return this.db.asset.update({
            where: { id },
            data
        })
    }

    async recordDepreciation(assetId: string, amount: number, notes?: string): Promise<AssetDepreciationLog> {
        return this.db.$transaction(async (tx) => {
            // 1. Create Log
            const log = await tx.assetDepreciationLog.create({
                data: {
                    id: crypto.randomUUID(),
                    assetId,
                    amount,
                    notes: notes ?? null,
                    date: new Date()
                }
            })

            // 2. Update Asset Value
            await tx.asset.update({
                where: { id: assetId },
                data: {
                    currentValue: { decrement: amount }
                }
            })

            return log
        })
    }

    async findAllAssets(params?: {
        skip?: number
        take?: number
        search?: string
        status?: AssetStatus
        barangId?: string
        location?: string
    }): Promise<{ items: AssetWithRelations[]; total: number }> {
        const { skip, take, search, status, barangId, location } = params || {}
        const where: Prisma.AssetWhereInput = {}

        if (status) where.status = status
        if (barangId) where.barangId = barangId
        if (location) where.location = { contains: location, mode: 'insensitive' }

        if (search) {
            where.OR = [
                { kodeAsset: { contains: search, mode: 'insensitive' } },
                { barang: { nama: { contains: search, mode: 'insensitive' } } }
            ]
        }

        const [total, items] = await this.db.$transaction([
            this.db.asset.count({ where }),
            this.db.asset.findMany({
                where,
                include: {
                    barang: true,
                    user: { select: { id: true, name: true, email: true } },
                    depreciationLogs: { take: 1, orderBy: { date: 'desc' } }
                },
                orderBy: { createdAt: 'desc' },
                ...(skip !== undefined ? { skip } : {}),
                ...(take !== undefined ? { take } : {})
            })
        ])
        
        return { items: items as AssetWithRelations[], total }
    }

    async getActiveAssetsForDepreciation(): Promise<Asset[]> {
        return this.db.asset.findMany({
            where: {
                status: { in: [AssetStatus.ACTIVE, AssetStatus.INSTALLED] },
                currentValue: { gt: 0 } // Only depreciate if value remains
            }
        })
    }
}
