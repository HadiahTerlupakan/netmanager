import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { IPengeluaranRepository, PengeluaranCreateData, PengeluaranUpdateData, PengeluaranPublic } from './IPengeluaranRepository'

export class PengeluaranRepository implements IPengeluaranRepository {
  constructor(private client: PrismaClient = prisma) { }

  async findAll(): Promise<PengeluaranPublic[]> {
    try {
      // Check if pengeluaran model exists in Prisma Client
      if (!('pengeluaran' in this.client)) {
        console.warn('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
        return []
      }
      const items = await (this.client as any).pengeluaran.findMany({
        orderBy: { tanggal: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          updatedByUser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return items.map((item: any) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PengeluaranPublic[]
    } catch (error: any) {
      // Jika model belum ada, return empty array
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        console.warn('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate dan restart dev server')
        return []
      }
      throw error
    }
  }

  async findById(id: string): Promise<PengeluaranPublic | null> {
    try {
      if (!('pengeluaran' in this.client)) {
        return null
      }
      const item = await (this.client as any).pengeluaran.findUnique({
        where: { id },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          updatedByUser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      if (!item) return null
      // Convert BigInt to string for JSON serialization
      return {
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      } as unknown as PengeluaranPublic
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return null
      }
      throw error
    }
  }

  async create(data: PengeluaranCreateData): Promise<{ id: string }> {
    if (!('pengeluaran' in this.client)) {
      throw new Error('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }
    // Convert jumlah to BigInt
    let jumlahBigInt: bigint
    if (typeof data.jumlah === 'bigint') {
      jumlahBigInt = data.jumlah
    } else if (typeof data.jumlah === 'string') {
      jumlahBigInt = BigInt(data.jumlah)
    } else {
      jumlahBigInt = BigInt(data.jumlah)
    }

    // Auto-link to budget if possible
    let budgetId: string | null = null

    if (data.kategori && 'budget' in this.client) {
      try {
        const { getBudgetCategory } = await import('@/modules/finance/services/budget-integration')
        const budgetCategory = getBudgetCategory(data.kategori)

        if (budgetCategory) {
          // Find active budget for current period
          const expenseDate = typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal
          const month = expenseDate.getMonth() + 1
          const year = expenseDate.getFullYear()

          const budget = await (this.client as any).budget.findFirst({
            where: {
              category: budgetCategory,
              month,
              year,
              status: { in: ['APPROVED', 'ACTIVE'] },
            },
          })

          if (budget) {
            budgetId = budget.id

            // Update budget actual amount
            const newActualAmount = budget.actualAmount + jumlahBigInt
            const newVariance = newActualAmount - budget.budgetAmount
            const newVariancePercent = Number(newVariance) / Number(budget.budgetAmount) * 100

            await (this.client as any).budget.update({
              where: { id: budget.id },
              data: {
                actualAmount: newActualAmount,
                variance: newVariance,
                variancePercent: newVariancePercent,
              },
            })

            // Check if we need to create alerts
            const utilizationPercent = Number(newActualAmount) / Number(budget.budgetAmount) * 100

            // Create alert if crossing thresholds (80%, 100%, 120%)
            if (utilizationPercent >= 80 && 'budgetAlert' in this.client) {
              const thresholds = [
                { threshold: 120, type: 'EXCEEDED_SIGNIFICANTLY', message: `Budget exceeded by ${(utilizationPercent - 100).toFixed(1)}%` },
                { threshold: 100, type: 'EXCEEDED', message: 'Budget limit reached or exceeded' },
                { threshold: 80, type: 'APPROACHING_LIMIT', message: 'Budget utilization at 80%' },
              ]

              for (const { threshold, type, message } of thresholds) {
                if (utilizationPercent >= threshold) {
                  // Check if alert already exists
                  const existingAlert = await (this.client as any).budgetAlert.findFirst({
                    where: {
                      budgetId: budget.id,
                      alertType: type,
                      isRead: false,
                    },
                  })

                  if (!existingAlert) {
                    await (this.client as any).budgetAlert.create({
                      data: {
                        budgetId: budget.id,
                        alertType: type,
                        threshold,
                        message: `${budgetCategory}: ${message}`,
                      },
                    })
                    console.log(`[Budget Alert] Created ${type} alert for budget ${budget.id}`)
                  }
                  break // Only create the highest severity alert
                }
              }
            }

            console.log(`[Budget Integration] Linked expense to budget ${budget.id}, updated actual amount`)
          }
        }
      } catch (error) {
        console.error('[Budget Integration] Failed to link expense to budget:', error)
        // Don't fail expense creation if budget link fails
      }
    }

    // Create the expense record first
    const created = await (this.client as any).pengeluaran.create({
      data: {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal,
        nomorBukti: data.nomorBukti,
        tipePengeluaran: data.tipePengeluaran,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        jumlah: jumlahBigInt,
        metodeBayar: data.metodeBayar ?? null,
        catatan: data.catatan ?? null,
        createdBy: data.createdBy ?? null,
        budgetId: budgetId, // Link to budget if found
      },
      select: { id: true },
    })

    // Auto-create PPN IN for vendor purchases with PPN
    // ISP typically pays PPN for: Equipment, Bandwidth, Infrastructure, Services
    const PPN_CATEGORIES = [
      'EQUIPMENT',
      'BANDWIDTH',
      'VENDOR',
      'INFRASTRUKTUR',
      'TEKNOLOGI',
      'PERALATAN',
      'FIBER',
      'EQUIPMENT_CORE',
      'INFRASTRUKTUR_PASIF',
    ]

    if (data.kategori && PPN_CATEGORIES.includes(data.kategori) && 'taxRecord' in this.client) {
      try {
        // Assumption: jumlah includes PPN (total amount)
        // Formula: DPP = Total / 1.11, PPN = Total - DPP
        const totalAmount = Number(jumlahBigInt)
        const dpp = Math.round(totalAmount / 1.11)
        const ppnAmount = totalAmount - dpp

        // Only create if PPN amount is significant (> Rp 1000)
        if (ppnAmount > 1000) {
          const expenseDate = typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal
          const month = expenseDate.getMonth() + 1
          const year = expenseDate.getFullYear()

          await (this.client as any).taxRecord.create({
            data: {
              taxType: 'PPN_IN',
              taxPeriod: month,
              taxYear: year,
              taxableAmount: BigInt(dpp),
              taxAmount: BigInt(ppnAmount),
              taxRate: 0.11,
              reference: `Expense: ${data.kategori}`,
              relatedEntityType: 'PENGELUARAN',
              relatedEntityId: created.id,
              status: 'DRAFT',
              notes: `Auto-created PPN IN from ${data.kategori} vendor purchase - ${data.deskripsi || ''}`.trim(),
            },
          })
          console.log(`[PPN IN Integration] Created PPN IN record for expense ${created.id} - DPP: ${dpp}, PPN: ${ppnAmount}`)
        }
      } catch (error) {
        console.error('[PPN IN Integration] Failed to create tax record:', error)
        // Don't fail expense creation if tax record creation fails
      }
    }

    return created
  }

  async update(id: string, data: PengeluaranUpdateData): Promise<void> {
    if (!('pengeluaran' in this.client)) {
      throw new Error('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }

    const updateData: any = {
      ...(data.tanggal !== undefined && {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal
      }),
      ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
      ...(data.tipePengeluaran !== undefined && { tipePengeluaran: data.tipePengeluaran }),
      ...(data.kategori !== undefined && { kategori: data.kategori }),
      ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
      ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
      ...(data.catatan !== undefined && { catatan: data.catatan }),
      ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
    }

    // Convert jumlah to BigInt if provided
    if (data.jumlah !== undefined) {
      if (typeof data.jumlah === 'bigint') {
        updateData.jumlah = data.jumlah
      } else if (typeof data.jumlah === 'string') {
        updateData.jumlah = BigInt(data.jumlah)
      } else {
        updateData.jumlah = BigInt(data.jumlah)
      }
    }

    await (this.client as any).pengeluaran.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: string): Promise<void> {
    if (!('pengeluaran' in this.client)) {
      throw new Error('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }
    await (this.client as any).pengeluaran.delete({ where: { id } })
  }

  async count(): Promise<number> {
    try {
      if (!('pengeluaran' in this.client)) {
        return 0
      }
      return await (this.client as any).pengeluaran.count()
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return 0
      }
      throw error
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<PengeluaranPublic[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }
      const items = await (this.client as any).pengeluaran.findMany({
        where: {
          tanggal: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { tanggal: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          updatedByUser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return items.map((item: any) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PengeluaranPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findByKategori(kategori: string): Promise<PengeluaranPublic[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }
      const items = await (this.client as any).pengeluaran.findMany({
        where: { kategori },
        orderBy: { tanggal: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          updatedByUser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return items.map((item: any) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PengeluaranPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async aggregateTotal(): Promise<bigint> {
    try {
      if (!('pengeluaran' in this.client)) {
        return BigInt(0)
      }
      const result = await (this.client as any).pengeluaran.aggregate({
        _sum: {
          jumlah: true,
        },
      })
      return result._sum.jumlah || BigInt(0)
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async aggregateTotalByTipe(tipePengeluaran: 'CAPEX' | 'OPEX'): Promise<bigint> {
    try {
      if (!('pengeluaran' in this.client)) {
        return BigInt(0)
      }
      const result = await (this.client as any).pengeluaran.aggregate({
        where: { tipePengeluaran },
        _sum: {
          jumlah: true,
        },
      })
      return result._sum.jumlah || BigInt(0)
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async groupByPeriode(): Promise<any[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }
      // Prisma doesn't support grouping by date parts directly in groupBy
      // So we fetch all dates and amounts and group in memory (still better than fetching full objects)
      // OR we can use raw query if needed, but let's stick to simple approach for now
      // Actually, for now let's fetch minimal data needed for grouping
      const items = await (this.client as any).pengeluaran.findMany({
        select: {
          tanggal: true,
          jumlah: true,
        }
      })

      return items.map((item: any) => ({
        tanggal: item.tanggal,
        jumlah: item.jumlah
      }))
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findIdsAndDates(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<{ id: string, tanggal: Date }[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }
      const where: any = {}
      if (startDate && endDate) {
        where.tanggal = {
          gte: startDate,
          lte: endDate,
        }
      }
      if (category) {
        where.kategori = category
      }
      if (paymentMethod) {
        where.metodeBayar = paymentMethod
      }
      if (searchDescription) {
        where.deskripsi = {
          contains: searchDescription,
          mode: 'insensitive'
        }
      }

      const items = await (this.client as any).pengeluaran.findMany({
        where,
        select: {
          id: true,
          tanggal: true,
        },
        orderBy: { tanggal: 'desc' },
      })
      return items.map((item: any) => ({
        id: item.id,
        tanggal: typeof item.tanggal === 'string' ? new Date(item.tanggal) : item.tanggal
      }))
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findByFilters(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<PengeluaranPublic[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }
      const where: any = {}
      if (startDate && endDate) {
        where.tanggal = {
          gte: startDate,
          lte: endDate,
        }
      }
      if (category) {
        where.kategori = category
      }
      if (paymentMethod) {
        where.metodeBayar = paymentMethod
      }
      if (searchDescription) {
        where.deskripsi = {
          contains: searchDescription,
          mode: 'insensitive'
        }
      }

      const items = await (this.client as any).pengeluaran.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          updatedByUser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return items.map((item: any) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PengeluaranPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    try {
      if (!('pengeluaran' in this.client)) {
        return BigInt(0)
      }

      const where: any = {}

      if (month !== undefined && year !== undefined) {
        where.tanggal = {
          gte: new Date(year, month - 1, 1), // Start of month
          lt: new Date(year, month, 1), // Start of next month
        }
      }

      const result = await (this.client as any).pengeluaran.aggregate({
        where,
        _sum: {
          jumlah: true,
        },
      })

      return result._sum.jumlah || BigInt(0)
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async aggregateTotalByTipeAndPeriod(tipePengeluaran: 'CAPEX' | 'OPEX', month?: number, year?: number): Promise<bigint> {
    try {
      if (!('pengeluaran' in this.client)) {
        return BigInt(0)
      }

      const where: any = { tipePengeluaran }

      if (month !== undefined && year !== undefined) {
        where.tanggal = {
          gte: new Date(year, month - 1, 1), // Start of month
          lt: new Date(year, month, 1), // Start of next month
        }
      }

      const result = await (this.client as any).pengeluaran.aggregate({
        where,
        _sum: {
          jumlah: true,
        },
      })

      return result._sum.jumlah || BigInt(0)
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async groupByCategoryAndPeriod(month?: number, year?: number): Promise<any[]> {
    try {
      if (!('pengeluaran' in this.client)) {
        return []
      }

      const where: any = {}

      if (month !== undefined && year !== undefined) {
        where.tanggal = {
          gte: new Date(year, month - 1, 1), // Start of month
          lt: new Date(year, month, 1), // Start of next month
        }
      }

      const items = await (this.client as any).pengeluaran.groupBy({
        by: ['kategori', 'tipePengeluaran'],
        where,
        _sum: {
          jumlah: true,
        },
        _count: {
          id: true,
        },
      })

      return items.map((item: any) => ({
        kategori: item.kategori || 'Lainnya',
        tipePengeluaran: item.tipePengeluaran || 'OPEX',
        _sum: {
          jumlah: Number(item._sum.jumlah || 0)
        },
        _count: {
          id: item._count.id || 0
        }
      }))
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }
}

