import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
    IInventoryRepository,
    CreateBarangInput,
    UpdateBarangInput,
    CreateBarangMasukInput,
    CreateBarangKeluarInput,
    BarangWithStock,
    BarangMasukWithRelations,
    BarangKeluarWithRelations,
    CreateGudangInput,
    UpdateGudangInput,
    CreateTransferInput
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
        isWorkOrderMaterial?: boolean
        siteId?: string
    }): Promise<{ items: BarangWithStock[]; total: number }> {
        const { skip, take, search, gudangId, isWorkOrderMaterial, siteId } = params || {}

        const where: Prisma.BarangWhereInput = {}

        if (search) {
            where.OR = [
                { nama: { contains: search, mode: 'insensitive' } },
                { kode: { contains: search, mode: 'insensitive' } }
            ]
        }

        if (isWorkOrderMaterial !== undefined) {
            (where as any).isWorkOrderMaterial = isWorkOrderMaterial
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
                barangGudang: {
                    where: {
                        AND: [
                            gudangId ? { gudangId } : {},
                            siteId ? { gudang: { sites: { some: { id: siteId } } } } : {}
                        ]
                    },
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
                barangGudang: {
                    include: { gudang: true }
                }
            }
        })
    }

    async findBarangByKode(kode: string): Promise<BarangWithStock | null> {
        return this.db.barang.findUnique({
            where: { kode },
            include: {
                barangGudang: {
                    include: { gudang: true }
                }
            }
        })
    }

    async createBarang(data: CreateBarangInput): Promise<any> {
        return this.db.barang.create({
            data: {
                id: crypto.randomUUID(),
                ...data,
                updatedAt: new Date(),
                isWorkOrderMaterial: data.isWorkOrderMaterial || false
            } as any
        })
    }

    async updateBarang(id: string, data: UpdateBarangInput): Promise<any> {
        return this.db.barang.update({
            where: { id },
            data
        })
    }

    async findBarangDetail(id: string): Promise<any | null> {
        const result = await this.db.barang.findUnique({
            where: { id },
            include: {
                barangGudang: {
                    include: { gudang: true }
                },
                barang_masuk: {
                    include: { gudang: true, user: { select: { id: true, name: true } } },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                },
                barang_keluar: {
                    include: { gudang: true, user: { select: { id: true, name: true } } },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                },
                stockOpname: {
                    include: { gudang: true },
                    orderBy: { tanggal: 'desc' },
                    take: 10
                }
            }
        })

        if (!result) return null

        return {
            ...result,
            masuk: result.barang_masuk,
            keluar: result.barang_keluar,
            opname: result.stockOpname
        }
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
                    id: crypto.randomUUID(),
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

            const updateData: any = {
                stok: { increment: data.jumlah }
            }

            // Determine which specific stock to increment
            if (data.kondisi === 'BARU') updateData.stokBaru = { increment: data.jumlah }
            else if (data.kondisi === 'BEKAS') updateData.stokBekas = { increment: data.jumlah }
            else if (data.kondisi === 'RUSAK') updateData.stokRusak = { increment: data.jumlah }
            else updateData.stokBaru = { increment: data.jumlah } // Default to BARU if unknown

            if (existingStock) {
                await tx.barangGudang.update({
                    where: { id: existingStock.id },
                    data: updateData
                })
            } else {
                await tx.barangGudang.create({
                    data: {
                        id: crypto.randomUUID(),
                        barangId: data.barangId,
                        gudangId: data.gudangId,
                        stok: data.jumlah,
                        stokBaru: data.kondisi === 'BARU' || !data.kondisi ? data.jumlah : 0,
                        stokBekas: data.kondisi === 'BEKAS' ? data.jumlah : 0,
                        stokRusak: data.kondisi === 'RUSAK' ? data.jumlah : 0,
                        updatedAt: new Date()
                    } as any
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

            if (!currentStock) {
                throw new Error('Stok tidak ditemukan')
            }

            // Check total stock first
            if (currentStock.stok < data.jumlah) {
                throw new Error('Total stok tidak mencukupi')
            }

            // Check specific condition stock
            let updateData: any = { stok: { decrement: data.jumlah } }

            const stockAny = currentStock as any
            if (data.kondisi === 'BARU') {
                if (stockAny.stokBaru < data.jumlah) throw new Error(`Stok BARU tidak mencukupi (Tersedia: ${stockAny.stokBaru})`)
                updateData.stokBaru = { decrement: data.jumlah }
            } else if (data.kondisi === 'BEKAS') {
                if (stockAny.stokBekas < data.jumlah) throw new Error(`Stok BEKAS tidak mencukupi (Tersedia: ${stockAny.stokBekas})`)
                updateData.stokBekas = { decrement: data.jumlah }
            } else if (data.kondisi === 'RUSAK') {
                if (stockAny.stokRusak < data.jumlah) throw new Error(`Stok RUSAK tidak mencukupi (Tersedia: ${stockAny.stokRusak})`)
                updateData.stokRusak = { decrement: data.jumlah }
            } else {
                if (stockAny.stokBaru < data.jumlah) throw new Error(`Stok BARU tidak mencukupi (Tersedia: ${stockAny.stokBaru})`)
                updateData.stokBaru = { decrement: data.jumlah }
            }

            // Update stock
            await tx.barangGudang.update({
                where: { id: currentStock.id },
                data: updateData
            })

            // 2. Create BarangKeluar record
            const keluar = await tx.barangKeluar.create({
                data: {
                    id: crypto.randomUUID(),
                    barangId: data.barangId,
                    gudangId: data.gudangId,
                    jumlah: data.jumlah,
                    kondisi: data.kondisi || 'BARU',
                    keterangan: data.keterangan,
                    tujuanPenggunaan: data.tujuanPenggunaan,
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

    async getAllGudang(params?: { siteId?: string }): Promise<any[]> {
        const { siteId } = params || {}
        const where: Prisma.GudangWhereInput = { isActive: true }

        if (siteId) {
            (where as any).sites = { some: { id: siteId } }
        }

        return this.db.gudang.findMany({
            where,
            orderBy: { nama: 'asc' }
        })
    }

    async findGudangById(id: string): Promise<any | null> {
        return this.db.gudang.findUnique({
            where: { id },
            include: {
                barangGudang: {
                    include: { barang: true }
                }
            }
        })
    }

    async findGudangByKode(kode: string): Promise<any | null> {
        return this.db.gudang.findUnique({
            where: { kode }
        })
    }

    async createGudang(data: CreateGudangInput): Promise<any> {
        const { siteIds, ...gudangData } = data
        return this.db.gudang.create({
            data: {
                id: crypto.randomUUID(),
                ...gudangData,
                updatedAt: new Date(),
                sites: siteIds && siteIds.length > 0 ? {
                    connect: siteIds.map(id => ({ id }))
                } : undefined
            },
            include: {
                sites: { select: { id: true, name: true, code: true } }
            }
        })
    }

    async updateGudang(id: string, data: UpdateGudangInput): Promise<any> {
        return this.db.gudang.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        })
    }

    async deleteGudang(id: string): Promise<void> {
        // Hard delete implementation
        await this.db.gudang.delete({
            where: { id }
        })
    }

    async hasStockInGudang(id: string): Promise<boolean> {
        const count = await this.db.barangGudang.count({
            where: { gudangId: id, stok: { gt: 0 } }
        })
        return count > 0
    }

    // Transfer Implementation
    async findAllTransfers(params?: {
        skip?: number
        take?: number
        barangId?: string
        dariGudangId?: string
        keGudangId?: string
        siteId?: string
    }): Promise<{ items: any[]; total: number }> {
        const { skip, take, barangId, dariGudangId, keGudangId, siteId } = params || {}
        const where: Prisma.TransferAntarGudangWhereInput = {}

        if (barangId) where.barangId = barangId
        if (dariGudangId) where.dariGudangId = dariGudangId
        if (keGudangId) where.keGudangId = keGudangId

        if (siteId) {
            where.OR = [
                { gudangDari: { sites: { some: { id: siteId } } } },
                { gudangKe: { sites: { some: { id: siteId } } } }
            ]
        }

        const [rawItems, total] = await Promise.all([
            this.db.transferAntarGudang.findMany({
                where,
                include: {
                    barang: { select: { id: true, kode: true, nama: true, satuan: true } },
                    gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
                    gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } }
                },
                orderBy: { tanggal: 'desc' },
                skip,
                take
            }),
            this.db.transferAntarGudang.count({ where })
        ])

        // Map to match frontend property names
        const items = rawItems.map(item => ({
            ...item,
            dariGudang: item.gudangDari,
            keGudang: item.gudangKe
        }))

        return { items, total }
    }

    async findTransferById(id: string): Promise<any | null> {
        return this.db.transferAntarGudang.findUnique({
            where: { id },
            include: {
                barang: { select: { id: true, kode: true, nama: true, satuan: true } },
                gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
                gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
                barangMasuk: { select: { id: true, tanggal: true, jumlah: true, kondisi: true, keterangan: true } },
                barangKeluar: { select: { id: true, tanggal: true, jumlah: true, kondisi: true, keterangan: true } }
            }
        })
    }

    async createTransfer(data: CreateTransferInput): Promise<any> {
        return this.db.$transaction(async (tx) => {
            const { barangId, dariGudangId, keGudangId, jumlah, kondisi = 'BARU' } = data

            // Check Barang
            const barang = await tx.barang.findUnique({ where: { id: barangId } })
            if (!barang) throw new Error('Barang tidak ditemukan')

            // Check Warehouses
            const [dariGudang, keGudang] = await Promise.all([
                tx.gudang.findUnique({ where: { id: dariGudangId, isActive: true } }),
                tx.gudang.findUnique({ where: { id: keGudangId, isActive: true } })
            ])
            if (!dariGudang) throw new Error('Gudang sumber tidak ditemukan atau tidak aktif')
            if (!keGudang) throw new Error('Gudang tujuan tidak ditemukan atau tidak aktif')
            if (dariGudangId === keGudangId) throw new Error('Gudang sumber dan tujuan tidak boleh sama')

            // Check Condition Stock (Logic similar to getStockBreakdown but inside TX for consistency)
            // Reuse getStockBreakdown logic but manually here to ensure we use this TX
            const [masukData, keluarData] = await Promise.all([
                tx.barangMasuk.findMany({ where: { barangId, gudangId: dariGudangId } }),
                tx.barangKeluar.findMany({ where: { barangId, gudangId: dariGudangId, isHilang: false } })
            ])

            let stokAvailable = 0
            // Calculate specific condition stock
            // Note: This is simpler than full breakdown if we only care about 'kondisi'
            // But existing logic iterates all to build state.
            let sBaru = 0, sBekas = 0, sRusak = 0
            masukData.forEach(m => {
                if (m.kondisi === 'BARU') sBaru += m.jumlah
                else if (m.kondisi === 'BEKAS') sBekas += m.jumlah
                else if (m.kondisi === 'RUSAK') sRusak += m.jumlah
                else sBaru += m.jumlah
            })
            keluarData.forEach(k => {
                if (k.kondisi === 'BARU') sBaru = Math.max(0, sBaru - k.jumlah)
                else if (k.kondisi === 'BEKAS') sBekas = Math.max(0, sBekas - k.jumlah)
                else if (k.kondisi === 'RUSAK') sRusak = Math.max(0, sRusak - k.jumlah)
                else sBaru = Math.max(0, sBaru - k.jumlah)
            })

            if (kondisi === 'BARU') stokAvailable = sBaru
            else if (kondisi === 'BEKAS') stokAvailable = sBekas
            else if (kondisi === 'RUSAK') stokAvailable = sRusak
            else stokAvailable = sBaru

            if (stokAvailable < jumlah) {
                throw new Error(`Stok ${kondisi.toLowerCase()} tidak mencukupi di gudang sumber. Stok tersedia: ${stokAvailable}`)
            }

            // Create Transfer Record
            const transferCode = `TRF${Date.now()}`
            const transfer = await tx.transferAntarGudang.create({
                data: {
                    id: crypto.randomUUID(),
                    kodeTransfer: transferCode,
                    barangId,
                    dariGudangId,
                    keGudangId,
                    jumlah,
                    kondisi,
                    keterangan: data.keterangan,
                    fotoBukti: data.fotoBukti || [],
                    fotoMetadata: data.fotoMetadata || null
                }
            })

            // Deduct from Source (Create Keluar + Update BarangGudang)
            const stockSumber = await tx.barangGudang.findUnique({
                where: { barangId_gudangId: { barangId, gudangId: dariGudangId } }
            })
            // Should not be null if calculation above found stock, but safety check:
            if (!stockSumber || stockSumber.stok < jumlah) throw new Error('Stok total tidak mencukupi di gudang sumber')

            await tx.barangKeluar.create({
                data: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId: dariGudangId,
                    transferId: transfer.id,
                    jumlah,
                    kondisi,
                    keterangan: `Transfer ke ${keGudang.nama} (${keGudang.kode})${data.keterangan ? ` - ${data.keterangan}` : ''}`,
                    userId: data.userId,
                    isHilang: false
                }
            })

            await tx.barangGudang.update({
                where: { id: stockSumber.id },
                data: { stok: stockSumber.stok - jumlah }
            })

            // Add to Dest (Create Masuk + Update/Create BarangGudang)
            await tx.barangMasuk.create({
                data: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId: keGudangId,
                    transferId: transfer.id,
                    jumlah,
                    kondisi,
                    keterangan: `Transfer dari ${dariGudang.nama} (${dariGudang.kode})${data.keterangan ? ` - ${data.keterangan}` : ''}`,
                    userId: data.userId
                }
            })

            const stockTujuan = await tx.barangGudang.findUnique({
                where: { barangId_gudangId: { barangId, gudangId: keGudangId } }
            })

            if (stockTujuan) {
                await tx.barangGudang.update({
                    where: { id: stockTujuan.id },
                    data: { stok: stockTujuan.stok + jumlah }
                })
            } else {
                await tx.barangGudang.create({
                    data: {
                        id: crypto.randomUUID(),
                        barangId,
                        gudangId: keGudangId,
                        stok: jumlah,
                        updatedAt: new Date()
                    }
                })
            }

            return transfer
        })
    }

    async updateTransfer(id: string, data: { keterangan?: string }): Promise<any> {
        return this.db.transferAntarGudang.update({
            where: { id },
            data,
            include: {
                barang: { select: { id: true, kode: true, nama: true } },
                gudangDari: { select: { id: true, kode: true, nama: true } },
                gudangKe: { select: { id: true, kode: true, nama: true } }
            }
        })
    }

    async deleteTransfer(id: string): Promise<void> {
        await this.db.$transaction(async (tx) => {
            const transfer = await tx.transferAntarGudang.findUnique({
                where: { id },
                include: { barangMasuk: true, barangKeluar: true }
            })
            if (!transfer) throw new Error('Record transfer tidak ditemukan')

            // Logic to revert:
            // 1. Check if Dest has enough stock to return (condition-wise)?
            // (Re-using similar logic to createTransfer condition check but for Destination)
            const [masukData, keluarData] = await Promise.all([
                tx.barangMasuk.findMany({ where: { barangId: transfer.barangId, gudangId: transfer.keGudangId } }),
                tx.barangKeluar.findMany({ where: { barangId: transfer.barangId, gudangId: transfer.keGudangId, isHilang: false } })
            ])
            let sBaru = 0, sBekas = 0, sRusak = 0
            masukData.forEach(m => {
                if (m.kondisi === 'BARU') sBaru += m.jumlah
                else if (m.kondisi === 'BEKAS') sBekas += m.jumlah
                else if (m.kondisi === 'RUSAK') sRusak += m.jumlah
                else sBaru += m.jumlah
            })
            keluarData.forEach(k => {
                if (k.kondisi === 'BARU') sBaru = Math.max(0, sBaru - k.jumlah)
                else if (k.kondisi === 'BEKAS') sBekas = Math.max(0, sBekas - k.jumlah)
                else if (k.kondisi === 'RUSAK') sRusak = Math.max(0, sRusak - k.jumlah)
                else sBaru = Math.max(0, sBaru - k.jumlah)
            })

            let stokAvailable = 0
            if (transfer.kondisi === 'BARU') stokAvailable = sBaru
            else if (transfer.kondisi === 'BEKAS') stokAvailable = sBekas
            else if (transfer.kondisi === 'RUSAK') stokAvailable = sRusak
            else stokAvailable = sBaru

            if (stokAvailable < transfer.jumlah) {
                throw new Error('Stok di gudang tujuan tidak mencukupi untuk pembatalan transfer')
            }

            // 2. Reduce Dest Stock
            const stockTujuan = await tx.barangGudang.findUnique({
                where: { barangId_gudangId: { barangId: transfer.barangId, gudangId: transfer.keGudangId } }
            })
            if (!stockTujuan) throw new Error('Stok tidak ditemukan di gudang tujuan')

            if (stockTujuan.stok - transfer.jumlah === 0) {
                await tx.barangGudang.delete({ where: { id: stockTujuan.id } })
            } else {
                await tx.barangGudang.update({
                    where: { id: stockTujuan.id },
                    data: { stok: stockTujuan.stok - transfer.jumlah }
                })
            }

            // 3. Add back to Source Stock
            const stockSumber = await tx.barangGudang.findUnique({
                where: { barangId_gudangId: { barangId: transfer.barangId, gudangId: transfer.dariGudangId } }
            })
            if (stockSumber) {
                await tx.barangGudang.update({
                    where: { id: stockSumber.id },
                    data: { stok: stockSumber.stok + transfer.jumlah }
                })
            } else {
                await tx.barangGudang.create({
                    data: {
                        id: crypto.randomUUID(),
                        barangId: transfer.barangId,
                        gudangId: transfer.dariGudangId,
                        stok: transfer.jumlah,
                        updatedAt: new Date()
                    }
                })
            }

            // 4. Delete Masuk/Keluar/Transfer
            await tx.barangMasuk.deleteMany({ where: { transferId: id } })
            await tx.barangKeluar.deleteMany({ where: { transferId: id } })
            await tx.transferAntarGudang.delete({ where: { id } })
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
        search?: string
        siteId?: string
    }): Promise<{ items: BarangMasukWithRelations[]; total: number }> {
        const { skip, take, barangId, gudangId, startDate, endDate, search, siteId } = params || {}

        const where: Prisma.BarangMasukWhereInput = {}

        if (barangId) where.barangId = barangId
        if (gudangId) where.gudangId = gudangId

        if (siteId) {
            where.gudang = {
                sites: {
                    some: {
                        id: siteId
                    }
                }
            }
        }

        if (search) {
            where.OR = [
                { barang: { nama: { contains: search, mode: 'insensitive' } } },
                { barang: { kode: { contains: search, mode: 'insensitive' } } },
                { gudang: { nama: { contains: search, mode: 'insensitive' } } },
                { user: { name: { contains: search, mode: 'insensitive' } } }
            ]
        }

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
        search?: string
        siteId?: string
    }): Promise<{ items: BarangKeluarWithRelations[]; total: number }> {
        const { skip, take, barangId, gudangId, startDate, endDate, search, siteId } = params || {}

        const where: Prisma.BarangKeluarWhereInput = {}

        if (barangId) where.barangId = barangId
        if (gudangId) where.gudangId = gudangId

        if (siteId) {
            where.gudang = {
                sites: {
                    some: {
                        id: siteId
                    }
                }
            }
        }

        if (search) {
            where.OR = [
                { barang: { nama: { contains: search, mode: 'insensitive' } } },
                { barang: { kode: { contains: search, mode: 'insensitive' } } },
                { gudang: { nama: { contains: search, mode: 'insensitive' } } },
                { user: { name: { contains: search, mode: 'insensitive' } } }
            ]
        }

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
