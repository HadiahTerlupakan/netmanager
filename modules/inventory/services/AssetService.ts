import { AssetRepository } from '../repositories/AssetRepository'
import type { CreateAssetInput, UpdateAssetInput, AssetWithRelations } from '../repositories/AssetRepository'
import { FinanceService } from '../../finance/services/FinanceService'
import type { Asset } from '@prisma/client'
import { AssetStatus } from '@prisma/client'

export class AssetService {
    private assetRepo: AssetRepository
    private financeService: FinanceService

    constructor() {
        this.assetRepo = new AssetRepository()
        this.financeService = new FinanceService()
    }

    async createAsset(data: CreateAssetInput, userId: string) {
        // Create the asset
        const asset = await this.assetRepo.createAsset({
            ...data,
            assignedTo: data.assignedTo // Optional
        })

        // Note: Initial Purchase expense is usually handled via Purchase Order / Finance separately
        // so we don't auto-create transaction here unless explicitly requested.
        // But we DO expect this asset to be capitalized.
        
        return asset
    }

    async getAsset(id: string): Promise<AssetWithRelations | null> {
        return this.assetRepo.findAssetById(id)
    }

    async updateAsset(id: string, data: UpdateAssetInput) {
        return this.assetRepo.updateAsset(id, data)
    }

    async findAllAssets(params: {
        page?: number
        limit?: number
        search?: string
        status?: AssetStatus
        barangId?: string
        location?: string
    }) {
        const { page = 1, limit = 10, ...rest } = params
        const skip = (page - 1) * limit
        return this.assetRepo.findAllAssets({
            skip,
            take: limit,
            ...rest
        })
    }

    /**
     * Calculates and processes monthly depreciation for a single asset.
     * Use this for ad-hoc or scheduled runs per asset.
     */
    async depreciateAsset(assetId: string, customDate: Date = new Date(), createdById: string) {
        const asset = await this.assetRepo.findAssetById(assetId)
        if (!asset) throw new Error('Asset not found')

        if (asset.status !== 'ACTIVE' && asset.status !== 'INSTALLED') {
            throw new Error(`Asset status is ${asset.status}, cannot depreciate.`)
        }

        if (asset.currentValue.toNumber() <= asset.residualValue.toNumber()) {
            return null // No depreciation needed, already at residual value
        }

        // Calculation: Straight Line
        // (Cost - Residual) / UsefulLife
        const cost = asset.purchasePrice.toNumber()
        const residual = asset.residualValue.toNumber()
        const lifeMonths = asset.usefulLife

        if (lifeMonths <= 0) throw new Error('Useful life must be > 0')

        const monthlyAmount = (cost - residual) / lifeMonths

        // Check if remaining value < monthlyAmount
        let actualAmount = monthlyAmount
        const currentVal = asset.currentValue.toNumber()
        
        // Ensure we don't go below residual
        if (currentVal - monthlyAmount < residual) {
            actualAmount = currentVal - residual
        }

        if (actualAmount <= 0) return null

        // 1. Record in Asset Log & Update Asset Value
        const log = await this.assetRepo.recordDepreciation(
            asset.id,
            actualAmount,
            `Depreciation for ${customDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`
        )

        // 2. Create Finance Expense
        // Find or create "Depreciation" category
        // For now, we search for a category named "Depreciation" or "Penyusutan" or "Beban Penyusutan"
        // TODO: Refactor to have a System Config for default categories
        const categories = await this.financeService.getAllCategories()
        let depCategory = categories.find(c => 
            c.name.toLowerCase().includes('penyusutan') || 
            c.name.toLowerCase().includes('depreciation')
        )
        
        if (!depCategory) {
            // Fallback: Create if not exists (or throw?)
            // Better to not auto-create without permission, use first Expense category or throw.
            // Let's rely on user having setup. If not found, look for "Operational" or similar.
            // Or create one for now to ensure logic flows.
            depCategory = await this.financeService.createCategory({
                name: 'Beban Penyusutan',
                type: 'EXPENSE',
                description: 'Auto-generated for Asset Depreciation'
            })
        }

        await this.financeService.createTransaction({
            type: 'EXPENSE',
            amount: actualAmount,
            date: customDate,
            categoryId: depCategory.id,
            description: `Penyusutan Aset: ${asset.barang.nama} (${asset.kodeAsset})`,
            createdById: createdById,
            referenceId: log.id // Link to log
        })

        return log
    }

    /**
     * Run monthly depreciation for ALL active assets.
     * To be called by Cron Job.
     */
    async runMonthlyDepreciationCycle(createdById: string) {
        const assets = await this.assetRepo.getActiveAssetsForDepreciation()
        const results = []

        for (const asset of assets) {
            try {
                const res = await this.depreciateAsset(asset.id, new Date(), createdById)
                if (res) results.push(res)
            } catch (error) {
                console.error(`Failed to depreciate asset ${asset.kodeAsset}:`, error)
                // Continue to next asset
            }
        }
        return results
    }
}
