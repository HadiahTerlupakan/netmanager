import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { IPemasukanRepository, PemasukanCreateData, PemasukanUpdateData, PemasukanPublic } from './IPemasukanRepository'

export class PemasukanRepository implements IPemasukanRepository {
  constructor(private client: PrismaClient = prisma) { }

  async findAll(): Promise<PemasukanPublic[]> {
    try {
      if (!('pemasukan' in this.client)) {
        console.warn('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
        return []
      }
      const items = await (this.client as any).pemasukan.findMany({
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
      })) as unknown as PemasukanPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        console.warn('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate dan restart dev server')
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
      const item = await (this.client as any).pemasukan.findUnique({
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
      } as unknown as PemasukanPublic
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return null
      }
      throw error
    }
  }

  async create(data: PemasukanCreateData): Promise<{ id: string }> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
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

    const created = await (this.client as any).pemasukan.create({
      data: {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        jumlah: jumlahBigInt,
        metodeBayar: data.metodeBayar ?? null,
        catatan: data.catatan ?? null,
        createdBy: data.createdBy ?? null,
      },
      select: { id: true },
    })
    return created
  }

  async update(id: string, data: PemasukanUpdateData): Promise<void> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }

    const updateData: any = {
      ...(data.tanggal !== undefined && {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal
      }),
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

    await (this.client as any).pemasukan.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: string): Promise<void> {
    if (!('pemasukan' in this.client)) {
      throw new Error('Model Pemasukan belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }
    await (this.client as any).pemasukan.delete({ where: { id } })
  }

  async count(): Promise<number> {
    try {
      if (!('pemasukan' in this.client)) {
        return 0
      }
      return await (this.client as any).pemasukan.count()
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
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
      const items = await (this.client as any).pemasukan.findMany({
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
      })) as unknown as PemasukanPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
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
      const items = await (this.client as any).pemasukan.findMany({
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
      })) as unknown as PemasukanPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
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
      const result = await (this.client as any).pemasukan.aggregate({
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
      if (!('pemasukan' in this.client)) {
        return []
      }
      // Prisma doesn't support grouping by date parts directly in groupBy
      // So we fetch minimal data needed for grouping
      const items = await (this.client as any).pemasukan.findMany({
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

  async findIdsAndDates(startDate?: Date, endDate?: Date): Promise<{ id: string, tanggal: Date }[]> {
    try {
      if (!('pemasukan' in this.client)) {
        return []
      }
      const where: any = {}
      if (startDate && endDate) {
        where.tanggal = {
          gte: startDate,
          lte: endDate,
        }
      }

      const items = await (this.client as any).pemasukan.findMany({
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
}

