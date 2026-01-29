
import { AssetRepository } from './AssetRepository'
import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
    KondisiBarang,
    BarangMasuk,
    BarangKeluar,
    BarangGudang,
    StockOpname,
    JenisBarang,
    KategoriAset
} from '@prisma/client'
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

        // REMOVED SITE RESTRICTION ON ITEM LIST: 
        // We want all items to be visible in the search/catalog even if they don't have stock in the current site yet.
        // The site restriction should only apply to stocks calculation (barangGudang include), not the item's existence.

        // Count total matches
        const total = await this.db.barang.count({ where })

        const queryOptions: Prisma.BarangFindManyArgs = {
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
            orderBy: { nama: 'asc' }
        }

        if (skip !== undefined) queryOptions.skip = skip
        if (take !== undefined) queryOptions.take = take

        const items = await this.db.barang.findMany(queryOptions) as BarangWithStock[]

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

    async existsBarangByKode(kode: string): Promise<boolean> {
        const count = await this.db.barang.count({
            where: { kode }
        })
        return count > 0
    }

    async createBarang(data: CreateBarangInput): Promise<any> {
        return this.db.barang.create({
            data: {
                id: crypto.randomUUID(),
                ...data,
                updatedAt: new Date(),
                isWorkOrderMaterial: data.isWorkOrderMaterial || false,
                jenis: data.jenis, // Optional: defaults to HABIS_PAKAI in DB if undefined, or explicit
                kategoriAset: data.kategoriAset
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
                    hargaBeliSatuan: data.hargaBeliSatuan || 0,
                    kondisi: data.kondisi || 'BARU',
                    keterangan: data.keterangan || null,
                    userId: data.userId || null,
                    tanggal: data.tanggal || new Date(),
                    fotoBukti: data.fotoBukti || [],
                    fotoMetadata: data.fotoMetadata || null
                },
                include: {
                    barang: true,
                    gudang: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            }) as any // Cast to allow relation access since TS inference might lag

            // 1.5. If Item is Fixed Asset, Auto-generate Asset Records
            // Using logic validation since Typescript might complain about relations on 'masuk' if not inferred correctly
            if (masuk.barang && masuk.barang.jenis === 'ASET') {
                const assetRepo = new AssetRepository()
                
                let usefulLife = 48
                // Map category to useful life
                if (masuk.barang.kategoriAset === 'KENDARAAN') usefulLife = 96
                if (masuk.barang.kategoriAset === 'BANGUNAN') usefulLife = 240
                if (masuk.barang.kategoriAset === 'FURNITURE') usefulLife = 96
                
                const assetsToCreate = []
                const prefix = `AST-${masuk.barang.kode}`
                const dateCode = new Date().toISOString().slice(2,7).replace('-','') // YYMM
                const timestamp = Date.now().toString(36).toUpperCase() // Base36 timestamp for uniqueness

                for (let i = 0; i < data.jumlah; i++) {
                    // Use timestamp + index + small random for guaranteed uniqueness
                    const uniqueSuffix = `${timestamp}${i.toString().padStart(3, '0')}`
                    assetsToCreate.push({
                        barangId: data.barangId,
                        kodeAsset: `${prefix}-${dateCode}-${uniqueSuffix}`, 
                        purchaseDate: data.tanggal || new Date(),
                        purchasePrice: data.hargaBeliSatuan || 0,
                        currentValue: data.hargaBeliSatuan || 0, // Set initial value = purchase price
                        usefulLife: usefulLife,
                        residualValue: 0,
                        status: 'ACTIVE' as const, 
                        location: masuk.gudang?.nama || 'Gudang Utama',
                        assignedTo: null
                    })
                }

                if (assetsToCreate.length > 0) {
                     await tx.asset.createMany({
                        data: assetsToCreate.map(a => ({
                            id: crypto.randomUUID(),
                            ...a
                        }))
                     })
                }
            }

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
                    keterangan: data.keterangan || null,
                    tujuanPenggunaan: data.tujuanPenggunaan || null,
                    isHilang: data.isHilang || false,
                    userId: data.userId || null,
                    tanggal: data.tanggal || new Date(),
                    fotoBukti: data.fotoBukti || [],
                    fotoMetadata: data.fotoMetadata || null
                },
                include: {
                    barang: true,
                    gudang: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            })

            // 2.5. FIFO Asset Allocation (If Item is ASET)
            const keluarWithRelations = keluar as any
            if (keluarWithRelations.barang.jenis === 'ASET' && !data.isHilang) {
                // Find Oldest Assets (FIFO)
                // We pick assets that are ACTIVE in this Warehouse
                // Ordered by purchaseDate ASC, createdAt ASC
                const assetsToAllocate = await tx.asset.findMany({
                    where: {
                        barangId: data.barangId,
                        status: 'ACTIVE', 
                        location: keluarWithRelations.gudang.nama // Assuming location matches Warehouse Name logic from addStock
                        // Note: Ideally location should be linked to gudangId relation, but current schema uses string 'location'.
                        // We rely on string matching or we upgrade schema later. 
                        // For now, let's assume assets created in this warehouse have this location string.
                    },
                    orderBy: [
                        { purchaseDate: 'asc' },
                        { createdAt: 'asc' }
                    ],
                    take: data.jumlah
                })

                // Only allocate if we found enough (or as many as possible)
                if (assetsToAllocate.length > 0) {
                    const assetIds = assetsToAllocate.map(a => a.id)
                    
                    // Update Status to INSTALLED (or 'ISSUED' if we had that status, but user context implies deployment)
                    // If just taking out of warehouse for WO, usually becomes INSTALLED.
                    await tx.asset.update({
                        where: { id: { in: assetIds } },
                        data: {
                            status: 'INSTALLED',
                            location: `Deployed (Ref: ${keluarWithRelations.keterangan || 'Barang Keluar'})`, // Update location context
                            assignedTo: data.userId || null
                        }
                    } as any)
                }
            }

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
        const createData: Prisma.GudangCreateInput = {
            id: crypto.randomUUID(),
            ...gudangData,
            updatedAt: new Date(),
        }

        if (siteIds && siteIds.length > 0) {
            createData.sites = {
                connect: siteIds.map(id => ({ id }))
            }
        }

        return this.db.gudang.create({
            data: createData,
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

        const queryOptions: Prisma.TransferAntarGudangFindManyArgs = {
            where,
            include: {
                barang: { select: { id: true, kode: true, nama: true, satuan: true } },
                gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
                gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
                createdBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { tanggal: 'desc' }
        }

        if (skip !== undefined) queryOptions.skip = skip
        if (take !== undefined) queryOptions.take = take

        const [rawItems, total] = await Promise.all([
            this.db.transferAntarGudang.findMany(queryOptions),
            this.db.transferAntarGudang.count({ where })
        ])

        const typedRawItems = rawItems as any[]

        // Map to match frontend property names
        const items = typedRawItems.map(item => ({
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
                    keterangan: data.keterangan || null,
                    createdById: data.userId,
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

            // Determine which stock field to update based on kondisi
            const stockField = kondisi === 'BARU' ? 'stokBaru' : 
                              kondisi === 'BEKAS' ? 'stokBekas' : 
                              kondisi === 'RUSAK' ? 'stokRusak' : 'stokBaru'
            
            const decrementData: any = { stok: stockSumber.stok - jumlah }
            decrementData[stockField] = { decrement: jumlah }

            await tx.barangGudang.update({
                where: { id: stockSumber.id },
                data: decrementData
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
                const incrementData: any = { stok: stockTujuan.stok + jumlah }
                incrementData[stockField] = { increment: jumlah }
                
                await tx.barangGudang.update({
                    where: { id: stockTujuan.id },
                    data: incrementData
                })
            } else {
                const createData: any = {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId: keGudangId,
                    stok: jumlah,
                    stokBaru: 0,
                    stokBekas: 0,
                    stokRusak: 0,
                    updatedAt: new Date()
                }
                createData[stockField] = jumlah // Set the appropriate stock field
                
                await tx.barangGudang.create({
                    data: createData
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

        const queryOptions: Prisma.BarangMasukFindManyArgs = {
            where,
            include: {
                barang: true,
                gudang: true,
                user: { select: { id: true, name: true } }
            },
            orderBy: { tanggal: 'desc' }
        }

        if (skip !== undefined) queryOptions.skip = skip
        if (take !== undefined) queryOptions.take = take

        const items = await this.db.barangMasuk.findMany(queryOptions) as BarangMasukWithRelations[] // Cast usually safe here due to structure match

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

        const queryOptions: Prisma.BarangKeluarFindManyArgs = {
            where,
            include: {
                barang: true,
                gudang: true,
                user: { select: { id: true, name: true } }
            },
            orderBy: { tanggal: 'desc' }
        }

        if (skip !== undefined) queryOptions.skip = skip
        if (take !== undefined) queryOptions.take = take

        const items = await this.db.barangKeluar.findMany(queryOptions) as BarangKeluarWithRelations[]

        return { items, total }
    }
}
