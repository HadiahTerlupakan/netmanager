import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { IPemasukanRepository, PemasukanCreateData, PemasukanUpdateData, PemasukanPublic } from './IPemasukanRepository'

// Define a generic delegate interface for the missing model
interface GenericDelegate {
  findMany(args?: unknown): Promise<unknown[]>
  findUnique(args: unknown): Promise<unknown | null>
  create(args: unknown): Promise<unknown>
  update(args: unknown): Promise<unknown>
  delete(args: unknown): Promise<unknown>
  count(args?: unknown): Promise<number>
  aggregate(args: unknown): Promise<{ _sum: { jumlah: bigint | null } }>
}

export class PemasukanRepository implements IPemasukanRepository {
  constructor(private client: PrismaClient = prisma) { }

  private get delegate(): GenericDelegate {
    // We cast to unknown first, then to a shape that has 'pemasukan'
    // This assumes the runtime check has been done or will be handled by the try/catch blocks
    return (this.client as unknown as Record<string, GenericDelegate>).pemasukan
  }

  async findAll(): Promise<PemasukanPublic[]> {
    try {
      if (!('pemasukan' in this.client)) {
        console.warn('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
        return []
      }
      const items = await this.delegate.findMany({
        orderBy: { tanggal: 'desc' },
        include: {
          createdByuser: {
            select: { id: true, name: true, email: true }
          },
          updatedByuser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return (items as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : (item.jumlah as string | number)
      })) as unknown as PemasukanPublic[]
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        console.warn('Model Pemasukan belum tersedia di Prisma Client.')
        return []
      }
      throw error
    }
  }

  async findById(id: string): Promise<PemasukanPublic | null> {
    try {
      if (!('pemasukan' in this.client)) {
        return null
      }
      const item = await this.delegate.findUnique({
        where: { id },
        include: {
          createdByuser: {
            select: { id: true, name: true, email: true }
          },
          updatedByuser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      if (!item) return null
      // Convert BigInt to string for JSON serialization
      const typedItem = item as Record<string, unknown>
      return {
        ...typedItem,
        jumlah: typeof typedItem.jumlah === 'bigint' ? typedItem.jumlah.toString() : (typedItem.jumlah as string | number)
      } as unknown as PemasukanPublic
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return null
      }
      throw error
    }
  }

  async create(data: PemasukanCreateData): Promise<{ id: string }> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client.')
    }
    // Convert jumlah to BigInt
    let jumlahBigInt: bigint
    if (typeof data.jumlah === 'bigint') {
      jumlahBigInt = data.jumlah
    } else if (typeof data.jumlah === 'string') {
      jumlahBigInt = BigInt(data.jumlah)
    } else {
      // safe fallback or error? Assuming number or compatible
      jumlahBigInt = BigInt(data.jumlah as number)
    }

    const created = await this.delegate.create({
      data: {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal,
        nomorBukti: data.nomorBukti,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        jumlah: jumlahBigInt,
        metodeBayar: data.metodeBayar ?? null,
        catatan: data.catatan ?? null,
        createdBy: data.createdBy ?? null,
      },
      select: { id: true },
    })
    return created as { id: string }
  }

  async update(id: string, data: PemasukanUpdateData): Promise<void> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client.')
    }

    const updateData: Record<string, unknown> = {
      ...(data.tanggal !== undefined && {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal
      }),
      ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
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
        updateData.jumlah = BigInt(data.jumlah as number)
      }
    }

    await this.delegate.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: string): Promise<void> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client.')
    }
    await this.delegate.delete({ where: { id } })
  }

  async count(): Promise<number> {
    try {
      if (!('pemasukan' in this.client)) {
        return 0
      }
      return await this.delegate.count()
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return 0
      }
      throw error
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<PemasukanPublic[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      const items = await this.delegate.findMany({
        where: {
          tanggal: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { tanggal: 'desc' },
        include: {
          createdByuser: {
            select: { id: true, name: true, email: true }
          },
          updatedByuser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return (items as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PemasukanPublic[]
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findByKategori(kategori: string): Promise<PemasukanPublic[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      const items = await this.delegate.findMany({
        where: { kategori },
        orderBy: { tanggal: 'desc' },
        include: {
          createdByuser: {
            select: { id: true, name: true, email: true }
          },
          updatedByuser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return (items as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PemasukanPublic[]
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async aggregateTotal(): Promise<bigint> {
    try {
      if (!('pemasukan' in this.client)) {
        return BigInt(0)
      }
      const result = await this.delegate.aggregate({
        _sum: {
          jumlah: true,
        },
      })
      return result._sum.jumlah || BigInt(0)
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    try {
      if (!('pemasukan' in this.client)) {
        return BigInt(0)
      }

      const where: Record<string, unknown> = {}

      if (month !== undefined && year !== undefined) {
        where.tanggal = {
          gte: new Date(year, month - 1, 1), // Start of month
          lt: new Date(year, month, 1), // Start of next month
        }
      }

      const result = await this.delegate.aggregate({
        where,
        _sum: {
          jumlah: true,
        },
      })

      return result._sum.jumlah || BigInt(0)
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return BigInt(0)
      }
      throw error
    }
  }

  async groupByPeriode(): Promise<{ tanggal: Date, jumlah: bigint }[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      // Prisma doesn't support grouping by date parts directly in groupBy
      // So we fetch minimal data needed for grouping
      const items = await this.delegate.findMany({
        select: {
          tanggal: true,
          jumlah: true,
        }
      })

      return (items as Array<Record<string, unknown>>).map((item) => ({
        tanggal: item.tanggal as Date,
        jumlah: item.jumlah as bigint
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findIdsAndDates(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<{ id: string, tanggal: Date }[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      const where: Record<string, unknown> = {}
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

      const items = await this.delegate.findMany({
        where,
        select: {
          id: true,
          tanggal: true,
        },
        orderBy: { tanggal: 'desc' },
      })
      return (items as Array<{ id: string, tanggal: Date | string }>).map((item) => ({
        id: item.id,
        tanggal: typeof item.tanggal === 'string' ? new Date(item.tanggal) : item.tanggal
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }

  async findByFilters(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<PemasukanPublic[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      const where: Record<string, unknown> = {}
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

      const items = await this.delegate.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        include: {
          createdByuser: {
            select: { id: true, name: true, email: true }
          },
          updatedByuser: {
            select: { id: true, name: true, email: true }
          },
        }
      })
      // Convert BigInt to string for JSON serialization
      return (items as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
        ...item,
        jumlah: typeof item.jumlah === 'bigint' ? item.jumlah.toString() : item.jumlah
      })) as unknown as PemasukanPublic[]
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Unknown model') || err.message?.includes('does not exist') || err.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }
}

