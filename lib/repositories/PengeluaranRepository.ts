import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { IPengeluaranRepository, PengeluaranCreateData, PengeluaranUpdateData, PengeluaranPublic } from './IPengeluaranRepository'

export class PengeluaranRepository implements IPengeluaranRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<PengeluaranPublic[]> {
    try {
      // Check if pengeluaran model exists in Prisma Client
      if (!('pengeluaran' in this.client)) {
        console.warn('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
        return []
      }
      const items = await (this.client as any).pengeluaran.findMany({ 
        orderBy: { tanggal: 'desc' } 
      })
      return items as unknown as PengeluaranPublic[]
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
      const item = await (this.client as any).pengeluaran.findUnique({ where: { id } })
      return item as unknown as PengeluaranPublic | null
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
    const created = await (this.client as any).pengeluaran.create({
      data: {
        tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        jumlah: data.jumlah,
        metodeBayar: data.metodeBayar ?? null,
        catatan: data.catatan ?? null,
        createdBy: data.createdBy ?? null,
      },
      select: { id: true },
    })
    return created
  }

  async update(id: string, data: PengeluaranUpdateData): Promise<void> {
    if (!('pengeluaran' in this.client)) {
      throw new Error('Model Pengeluaran belum tersedia di Prisma Client. Pastikan sudah menjalankan: npx prisma generate')
    }
    await (this.client as any).pengeluaran.update({
      where: { id },
      data: {
        ...(data.tanggal !== undefined && { 
          tanggal: typeof data.tanggal === 'string' ? new Date(data.tanggal) : data.tanggal 
        }),
        ...(data.kategori !== undefined && { kategori: data.kategori }),
        ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
        ...(data.jumlah !== undefined && { jumlah: data.jumlah }),
        ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
        ...(data.catatan !== undefined && { catatan: data.catatan }),
        ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
      },
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
      })
      return items as unknown as PengeluaranPublic[]
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
    })
    return items as unknown as PengeluaranPublic[]
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }
}

