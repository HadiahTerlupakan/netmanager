import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
    IInventoryRepository,
    CreateBarangInput,
    UpdateBarangInput,
    CreateBarangMasukInput,
    CreateBarangKeluarInput,
    BarangWithStock,
    BarangMasukWithRelations,
    BarangKeluarWithRelations
} from './IInventoryRepository'

export class InventoryRepository implements IInventoryRepository {
    private db: PrismaClient

    constructor() {
        this.db = prisma
    }

    async findAllBarang(params?: {
        skip?: number
        take?: number
        search?: string
        gudangId?: string
    }): Promise<{ items: BarangWithStock[]; total: number }> {
        const { skip, take, search, gudangId } = params || {}

        const where: Prisma.BarangWhereInput = {}

        if (search) {
            where.OR = [
                { nama: { contains: search, mode: 'insensitive' } },
                { kode: { contains: search, mode: 'insensitive' } }
            ]
        }

        // Note: gudangId filter often implies filtering items *available* in a warehouse,
        // or simply loading stock for that warehouse. Prisma doesn't easily filter
        // parent by child condition while preserving parent structure unless using where clause on relation.
        // For now, if gudangId is provided, we filter items that have ANY record in that gudang (even 0 stock)
        // or we might just want to load the stock relations.
        // Let's assume we want all items, but specific stock info.

        // Count total matches
        const total = await this.db.barang.count({ where })

        const items = await this.db.barang.findMany({
            where,
            include: {
                stok: {
                    where: gudangId ? { gudangId } : undefined,
                    include: {
                        gudang: true
                    }
                }
            },
            orderBy: { nama: 'asc' },
            skip,
            take,
        })

        return { items, total }
    }

    async findBarangById(id: string): Promise<BarangWithStock | null> {
        return this.db.barang.findUnique({
            where: { id },
            include: {
                stok: {
                    include: { gudang: true }
                }
            }
        })
    }

    async findBarangByKode(kode: string): Promise<BarangWithStock | null> {
        return this.db.barang.findUnique({
            where: { kode },
            include: {
                stok: {
                    include: { gudang: true }
                }
            }
        })
    }

    async createBarang(data: CreateBarangInput): Promise<any> {
        return this.db.barang.create({
            data
        })
    }

    async updateBarang(id: string, data: UpdateBarangInput): Promise<any> {
        return this.db.barang.update({
            where: { id },
            data
        })
    }

    async findBarangDetail(id: string): Promise<any | null> {
        return this.db.barang.findUnique({
            where: { id },
            include: {
                stok: {
                    include: { gudang: true }
                },
                masuk: {
                    include: { gudang: true, user: { select: { id: true, name: true } } },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                },
                keluar: {
                    include: { gudang: true, user: { select: { id: true, name: true } } },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                },
                opname: {
                    include: { gudang: true },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                }
            }
        })
    }

    async deleteBarang(id: string): Promise<void> {
        await this.db.$transaction(async (tx) => {
            // Delete all related records in correct order
            await tx.barangMasuk.deleteMany({
                where: { barangId: id }
            })

            await tx.barangKeluar.deleteMany({
                where: { barangId: id }
            })

            // Note: If you have StockOpname, include deletion here.
            // Using generic 'any' cast for tx if models are missing from standard context but exist in DB
            // Or assuming schema is up to date.
            await (tx as any).stockOpname.deleteMany({
                where: { barangId: id }
            })

            await tx.barangGudang.deleteMany({
                where: { barangId: id }
            })

            // Finally delete the barang
            await tx.barang.delete({
                where: { id }
            })
        })
    }

    async addStock(data: CreateBarangMasukInput): Promise<any> {
        return this.db.$transaction(async (tx) => {
            // 1. Create BarangMasuk record
            const masuk = await tx.barangMasuk.create({
                data: {
                    barangId: data.barangId,
                    gudangId: data.gudangId,
                    jumlah: data.jumlah,
                    kondisi: data.kondisi,
                    keterangan: data.keterangan,
                    userId: data.userId,
                    tanggal: data.tanggal,
                    fotoBukti: data.fotoBukti,
                    fotoMetadata: data.fotoMetadata
                },
                include: {
                    barang: true,
                    gudang: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            })

            // 2. Update or Create Stock in BarangGudang
            const existingStock = await tx.barangGudang.findUnique({
                where: {
                    barangId_gudangId: {
                        barangId: data.barangId,
                        gudangId: data.gudangId
                    }
                }
            })

            if (existingStock) {
                await tx.barangGudang.update({
                    where: { id: existingStock.id },
                    data: {
                        stok: { increment: data.jumlah }
                    }
                })
            } else {
                await tx.barangGudang.create({
                    data: {
                        barangId: data.barangId,
                        gudangId: data.gudangId,
                        stok: data.jumlah
                    }
                })
            }

            return masuk
        })
    }

    async removeStock(data: CreateBarangKeluarInput): Promise<any> {
        return this.db.$transaction(async (tx) => {
            // 1. Check current stock
            const currentStock = await tx.barangGudang.findUnique({
                where: {
                    barangId_gudangId: {
                        barangId: data.barangId,
                        gudangId: data.gudangId
                    }
                }
            })

            if (!currentStock || currentStock.stok < data.jumlah) {
                throw new Error('Stok tidak mencukupi')
            }

            // 2. Create BarangKeluar record
            const keluar = await tx.barangKeluar.create({
                data: {
                    barangId: data.barangId,
                    gudangId: data.gudangId,
                    jumlah: data.jumlah,
                    kondisi: data.kondisi,
                    keterangan: data.keterangan,
                    isHilang: data.isHilang || false,
                    userId: data.userId,
                    tanggal: data.tanggal,
                    fotoBukti: data.fotoBukti,
                    fotoMetadata: data.fotoMetadata
                },
                include: {
                    barang: true,
                    gudang: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            })

            // 3. Decrement Stock
            await tx.barangGudang.update({
                where: { id: currentStock.id },
                data: {
                    stok: { decrement: data.jumlah }
                }
            })

            return keluar
        })
    }

    async getStockLevel(barangId: string, gudangId: string): Promise<number> {
        const record = await this.db.barangGudang.findUnique({
            where: {
                barangId_gudangId: { barangId, gudangId }
            }
        })
        return record?.stok || 0
    }

    async getAllGudang(): Promise<any[]> {
        return this.db.gudang.findMany({
            orderBy: { nama: 'asc' }
        })
    }

    async getStockBreakdown(barangId: string, gudangId: string): Promise<{ baru: number, bekas: number, rusak: number, total: number }> {
        const [masukData, keluarData] = await Promise.all([
            this.db.barangMasuk.findMany({
                where: { barangId, gudangId }
            }),
            this.db.barangKeluar.findMany({
                where: { barangId, gudangId }
            })
        ])

        let stokBaru = 0
        let stokBekas = 0
        let stokRusak = 0

        // Process barang masuk
        masukData.forEach((masuk) => {
            switch (masuk.kondisi) {
                case 'BARU': stokBaru += masuk.jumlah; break;
                case 'BEKAS': stokBekas += masuk.jumlah; break;
                case 'RUSAK': stokRusak += masuk.jumlah; break;
                default: stokBaru += masuk.jumlah; break;
            }
        })

        // Process barang keluar
        keluarData.forEach((keluar) => {
            switch (keluar.kondisi) {
                case 'BARU': stokBaru = Math.max(0, stokBaru - keluar.jumlah); break;
                case 'BEKAS': stokBekas = Math.max(0, stokBekas - keluar.jumlah); break;
                case 'RUSAK': stokRusak = Math.max(0, stokRusak - keluar.jumlah); break;
                default: stokBaru = Math.max(0, stokBaru - keluar.jumlah); break;
            }
        })

        return {
            baru: stokBaru,
            bekas: stokBekas,
            rusak: stokRusak,
            total: stokBaru + stokBekas + stokRusak
        }
    }

    async getHistoryMasuk(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
    }): Promise<{ items: BarangMasukWithRelations[]; total: number }> {
        const { skip, take, barangId, gudangId, startDate, endDate } = params || {}

        const where: Prisma.BarangMasukWhereInput = {}

        if (barangId) where.barangId = barangId
        if (gudangId) where.gudangId = gudangId

        if (startDate || endDate) {
            where.tanggal = {}
            if (startDate) where.tanggal.gte = startDate
            if (endDate) where.tanggal.lte = endDate
        }

        const total = await this.db.barangMasuk.count({ where })

        const items = await this.db.barangMasuk.findMany({
            where,
            include: {
                barang: true,
                gudang: true,
                user: { select: { id: true, name: true } }
            },
            orderBy: { tanggal: 'desc' },
            skip,
            take
        }) as BarangMasukWithRelations[] // Cast usually safe here due to structure match

        return { items, total }
    }

    async getHistoryKeluar(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
    }): Promise<{ items: BarangKeluarWithRelations[]; total: number }> {
        const { skip, take, barangId, gudangId, startDate, endDate } = params || {}

        const where: Prisma.BarangKeluarWhereInput = {}

        if (barangId) where.barangId = barangId
        if (gudangId) where.gudangId = gudangId

        if (startDate || endDate) {
            where.tanggal = {}
            if (startDate) where.tanggal.gte = startDate
            if (endDate) where.tanggal.lte = endDate
        }

        const total = await this.db.barangKeluar.count({ where })

        const items = await this.db.barangKeluar.findMany({
            where,
            include: {
                barang: true,
                gudang: true,
                user: { select: { id: true, name: true } }
            },
            orderBy: { tanggal: 'desc' },
            skip,
            take
        }) as BarangKeluarWithRelations[]

        return { items, total }
    }
}
