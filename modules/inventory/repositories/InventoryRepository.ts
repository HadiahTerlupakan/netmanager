
import { PrismaClient, Prisma } from '@prisma/client'
import type { Barang, BarangMasuk, BarangKeluar, Gudang } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { USEFUL_LIFE_MONTHS, STOCK_FIELD_MAP, DEFAULT_KONDISI } from '@/lib/constants/inventory'
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
    CreateTransferInput,
    BarangDetail
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
            (where as Record<string, unknown>).isWorkOrderMaterial = isWorkOrderMaterial
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

        const items = await this.db.barang.findMany(queryOptions) as unknown as BarangWithStock[]

        return { items, total }
    }

    async findBarangById(id: string): Promise<BarangWithStock | null> {
        return this.db.barang.findUnique({
            where: { id },
            include: {
                barangGudang: {
                    include: {
                        gudang: {
                            include: { sites: true }
                        }
                    }
                }
            }
        }) as Promise<BarangWithStock | null>
    }

    async findBarangByKode(kode: string): Promise<BarangWithStock | null> {
        return this.db.barang.findUnique({
            where: { kode },
            include: {
                barangGudang: {
                    include: {
                        gudang: {
                            include: { sites: true }
                        }
                    }
                }
            }
        }) as Promise<BarangWithStock | null>
    }

    async existsBarangByKode(kode: string): Promise<boolean> {
        const count = await this.db.barang.count({
            where: { kode }
        })
        return count > 0
    }

    async createBarang(data: CreateBarangInput): Promise<Barang> {
        return this.db.barang.create({
            data: {
                id: crypto.randomUUID(),
                ...data,
                updatedAt: new Date(),
                isWorkOrderMaterial: data.isWorkOrderMaterial || false,
                jenis: data.jenis, // Optional: defaults to HABIS_PAKAI in DB if undefined, or explicit
                kategoriAset: data.kategoriAset
            } as Prisma.BarangCreateInput
        })
    }

    async updateBarang(id: string, data: UpdateBarangInput): Promise<Barang> {
        return this.db.barang.update({
            where: { id },
            data
        })
    }

    async findBarangDetail(id: string): Promise<BarangDetail | null> {
        const result = await this.db.barang.findUnique({
            where: { id },
            include: {
                barangGudang: {
                    include: {
                        gudang: {
                            include: { sites: true }
                        }
                    }
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
            masuk: result.barang_masuk as unknown as BarangMasukWithRelations[],
            keluar: result.barang_keluar as unknown as BarangKeluarWithRelations[],
            opname: result.stockOpname as unknown as Record<string, unknown>[]
        } as unknown as BarangDetail
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
            // Using structural type cast for tx if models are missing from standard context but exist in DB
            await (tx as unknown as { stockOpname: { deleteMany: (args: { where: { barangId: string } }) => Promise<unknown> } }).stockOpname.deleteMany({
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

    async addStock(data: CreateBarangMasukInput): Promise<BarangMasuk> {
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
                    fotoMetadata: (data.fotoMetadata as unknown as Prisma.InputJsonValue) || Prisma.JsonNull
                },
                include: {
                    barang: true,
                    gudang: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            })

            // 1.5. If Item is Fixed Asset, Auto-generate Asset Records
            // Using logic validation since Typescript might complain about relations on 'masuk' if not inferred correctly
            if (masuk.barang && masuk.barang.jenis === 'ASET') {
                // Use constant for useful life mapping
                const kategori = (masuk.barang as unknown as { kategoriAset: keyof typeof USEFUL_LIFE_MONTHS }).kategoriAset
                const usefulLife = USEFUL_LIFE_MONTHS[kategori] || USEFUL_LIFE_MONTHS.LAINNYA

                const assetsToCreate = []
                const prefix = `AST-${masuk.barang.kode}`
                const dateCode = new Date().toISOString().slice(2,7).replace('-','') // YYMM
                const timestamp = Date.now().toString(36).toUpperCase() // Base36 timestamp for uniqueness

                for (let i = 0; i < data.jumlah; i++) {
                    const uniqueSuffix = `${timestamp}${i.toString().padStart(3, '0')}`
                    assetsToCreate.push({
                        barangId: data.barangId,
                        kodeAsset: `${prefix}-${dateCode}-${uniqueSuffix}`,
                        purchaseDate: data.tanggal || new Date(),
                        purchasePrice: data.hargaBeliSatuan || 0,
                        currentValue: data.hargaBeliSatuan || 0,
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

            // 2. Update or Create Stock in BarangGudang using UPSERT (atomic operation)
            const kondisi = data.kondisi || DEFAULT_KONDISI
            const stockField = STOCK_FIELD_MAP[kondisi] || 'stokBaru'

            await tx.barangGudang.upsert({
                where: {
                    barangId_gudangId: {
                        barangId: data.barangId,
                        gudangId: data.gudangId
                    }
                },
                create: {
                    id: crypto.randomUUID(),
                    barangId: data.barangId,
                    gudangId: data.gudangId,
                    stok: data.jumlah,
                    stokBaru: kondisi === 'BARU' ? data.jumlah : 0,
                    stokBekas: kondisi === 'BEKAS' ? data.jumlah : 0,
                    stokRusak: kondisi === 'RUSAK' ? data.jumlah : 0,
                    updatedAt: new Date()
                },
                update: {
                    stok: { increment: data.jumlah },
                    [stockField]: { increment: data.jumlah },
                    updatedAt: new Date()
                } as Prisma.BarangGudangUpdateInput
            })

            return masuk as unknown as BarangMasuk
        })
    }

    async removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar> {
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

            if (currentStock.stok < data.jumlah) {
                throw new Error('Total stok tidak mencukupi')
            }

            const kondisi = data.kondisi || DEFAULT_KONDISI
            const stockField = STOCK_FIELD_MAP[kondisi] || 'stokBaru'

            const stokByKondisi = currentStock[stockField as keyof typeof currentStock] as number

            if (typeof stokByKondisi !== 'number' || isNaN(stokByKondisi)) {
                throw new Error(`Data stok tidak valid untuk kondisi ${kondisi}`)
            }

            if (stokByKondisi < data.jumlah) {
                throw new Error(`Stok ${kondisi} tidak mencukupi (Tersedia: ${stokByKondisi})`)
            }

            const updateData = {
                stok: { decrement: data.jumlah },
                [stockField]: { decrement: data.jumlah }
            } as Prisma.BarangGudangUpdateInput

            const updated = await tx.barangGudang.updateMany({
                where: {
                    id: currentStock.id,
                    stok: { gte: data.jumlah },
                    [stockField]: { gte: data.jumlah }
                },
                data: updateData
            })

            if (updated.count === 0) {
                throw new Error(`Stok ${kondisi} tidak mencukupi atau telah berubah (Tersedia: ${stokByKondisi})`)
            }

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
                    fotoMetadata: (data.fotoMetadata as unknown as Prisma.InputJsonValue) || Prisma.JsonNull
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
            const keluarWithRelations = keluar as unknown as { barang: { jenis: string }; gudang: { nama: string }; keterangan: string | null }
            if (keluarWithRelations.barang?.jenis === 'ASET' && !data.isHilang) {
                const assetsToAllocate = await tx.asset.findMany({
                    where: {
                        barangId: data.barangId,
                        status: 'ACTIVE',
                        location: keluarWithRelations.gudang?.nama
                    },
                    orderBy: [
                        { purchaseDate: 'asc' },
                        { createdAt: 'asc' }
                    ],
                    take: data.jumlah
                })

                if (assetsToAllocate.length > 0) {
                    const assetIds = assetsToAllocate.map(a => a.id)

                    await tx.asset.updateMany({
                        where: { id: { in: assetIds } },
                        data: {
                            status: 'INSTALLED',
                            location: `Deployed (Ref: ${keluarWithRelations.keterangan || 'Barang Keluar'})`,
                            assignedTo: data.userId || null
                        }
                    })
                }
            }

            return keluar as unknown as BarangKeluar
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

    async getAllGudang(params?: { siteId?: string }): Promise<Gudang[]> {
        const { siteId } = params || {}
        const where: Prisma.GudangWhereInput = { isActive: true }

        if (siteId) {
            (where as Record<string, unknown>).sites = { some: { id: siteId } }
        }

        return this.db.gudang.findMany({
            where,
            orderBy: { nama: 'asc' }
        })
    }

    async findGudangById(id: string): Promise<Gudang | null> {
        return this.db.gudang.findUnique({
            where: { id },
            include: {
                barangGudang: {
                    include: { barang: true }
                }
            }
        }) as unknown as Promise<Gudang | null>
    }

    async findGudangByKode(kode: string): Promise<Gudang | null> {
        return this.db.gudang.findUnique({
            where: { kode }
        })
    }

    async createGudang(data: CreateGudangInput): Promise<Gudang> {
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
        }) as unknown as Promise<Gudang>
    }

    async updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang> {
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
    }): Promise<{ items: Record<string, unknown>[]; total: number }> {
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

        const typedRawItems = rawItems as unknown as Array<{ gudangDari: unknown; gudangKe: unknown }>

        // Map to match frontend property names
        const items = typedRawItems.map(item => ({
            ...item,
            dariGudang: item.gudangDari,
            keGudang: item.gudangKe
        }))

        return { items, total }
    }

    async findTransferById(id: string): Promise<Record<string, unknown> | null> {
        return this.db.transferAntarGudang.findUnique({
            where: { id },
            include: {
                barang: { select: { id: true, kode: true, nama: true, satuan: true } },
                gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
                gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
                barangMasuk: { select: { id: true, tanggal: true, jumlah: true, kondisi: true, keterangan: true } },
                barangKeluar: { select: { id: true, tanggal: true, jumlah: true, kondisi: true, keterangan: true } }
            }
        }) as unknown as Promise<Record<string, unknown> | null>
    }

    async createTransfer(data: CreateTransferInput): Promise<Record<string, unknown>> {
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

            // Determine which stock field to check and update based on kondisi
            const stockField = STOCK_FIELD_MAP[kondisi] || 'stokBaru'

            // Atomic decrement from Source using updateMany to prevent race conditions
            const updatedSumber = await tx.barangGudang.updateMany({
                where: {
                    barangId,
                    gudangId: dariGudangId,
                    stok: { gte: jumlah },
                    [stockField]: { gte: jumlah }
                },
                data: {
                    stok: { decrement: jumlah },
                    [stockField]: { decrement: jumlah },
                    updatedAt: new Date()
                } as Prisma.BarangGudangUpdateInput
            })

            if (updatedSumber.count === 0) {
                throw new Error(`Stok ${kondisi.toLowerCase()} tidak mencukupi di gudang sumber atau telah berubah`)
            }

            // Create Transfer Record with unique code validation
            let transferCode = `TRF${Date.now()}`

            // Check for duplicate transfer code (rare but possible with concurrent requests)
            const existingTransfer = await tx.transferAntarGudang.findFirst({
                where: { kodeTransfer: transferCode }
            })

            // If duplicate exists, add random suffix
            if (existingTransfer) {
                transferCode = `TRF${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
            }

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
                    fotoMetadata: (data.fotoMetadata as unknown as Prisma.InputJsonValue) || Prisma.JsonNull
                }
            })

            // Create Keluar record for source
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

            // const stockTujuan = await tx.barangGudang.findUnique({
            //     where: { barangId_gudangId: { barangId, gudangId: keGudangId } }
            // })

            // Use upsert for atomic operation
            await tx.barangGudang.upsert({
                where: {
                    barangId_gudangId: { barangId, gudangId: keGudangId }
                },
                create: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId: keGudangId,
                    stok: jumlah,
                    stokBaru: kondisi === 'BARU' ? jumlah : 0,
                    stokBekas: kondisi === 'BEKAS' ? jumlah : 0,
                    stokRusak: kondisi === 'RUSAK' ? jumlah : 0,
                    updatedAt: new Date()
                },
                update: {
                    stok: { increment: jumlah },
                    [stockField]: { increment: jumlah },
                    updatedAt: new Date()
                } as Prisma.BarangGudangUpdateInput
            })

            return transfer
        })
    }

    async updateTransfer(id: string, data: { keterangan?: string }): Promise<Record<string, unknown>> {
        return this.db.transferAntarGudang.update({
            where: { id },
            data,
            include: {
                barang: { select: { id: true, kode: true, nama: true } },
                gudangDari: { select: { id: true, kode: true, nama: true } },
                gudangKe: { select: { id: true, kode: true, nama: true } }
            }
        }) as unknown as Promise<Record<string, unknown>>
    }

    async deleteTransfer(id: string): Promise<void> {
        await this.db.$transaction(async (tx) => {
            const transfer = await tx.transferAntarGudang.findUnique({
                where: { id },
                include: { barangMasuk: true, barangKeluar: true }
            })
            if (!transfer) throw new Error('Record transfer tidak ditemukan')

            // Logic to revert:
            // 1. Reduce Dest Stock with proper breakdown update (Atomic check & decrement)
            const stockFieldDel = STOCK_FIELD_MAP[transfer.kondisi] || 'stokBaru'

            const updatedTujuan = await tx.barangGudang.updateMany({
                where: {
                    barangId: transfer.barangId,
                    gudangId: transfer.keGudangId,
                    stok: { gte: transfer.jumlah },
                    [stockFieldDel]: { gte: transfer.jumlah }
                },
                data: {
                    stok: { decrement: transfer.jumlah },
                    [stockFieldDel]: { decrement: transfer.jumlah },
                    updatedAt: new Date()
                } as Prisma.BarangGudangUpdateInput
            })

            if (updatedTujuan.count === 0) {
                throw new Error('Stok di gudang tujuan tidak mencukupi untuk pembatalan transfer atau telah berubah')
            }

            // 2. Add back to Source Stock with proper breakdown update (Atomic upsert)
            const stockFieldAdd = STOCK_FIELD_MAP[transfer.kondisi] || 'stokBaru'

            await tx.barangGudang.upsert({
                where: {
                    barangId_gudangId: { barangId: transfer.barangId, gudangId: transfer.dariGudangId }
                },
                create: {
                    id: crypto.randomUUID(),
                    barangId: transfer.barangId,
                    gudangId: transfer.dariGudangId,
                    stok: transfer.jumlah,
                    stokBaru: transfer.kondisi === 'BARU' ? transfer.jumlah : 0,
                    stokBekas: transfer.kondisi === 'BEKAS' ? transfer.jumlah : 0,
                    stokRusak: transfer.kondisi === 'RUSAK' ? transfer.jumlah : 0,
                    updatedAt: new Date()
                },
                update: {
                    stok: { increment: transfer.jumlah },
                    [stockFieldAdd]: { increment: transfer.jumlah },
                    updatedAt: new Date()
                } as Prisma.BarangGudangUpdateInput
            })

            // 3. Delete Masuk/Keluar/Transfer
            await tx.barangMasuk.deleteMany({ where: { transferId: id } })
            await tx.barangKeluar.deleteMany({ where: { transferId: id } })
            await tx.transferAntarGudang.delete({ where: { id } })
        })
    }

    async getStockBreakdown(barangId: string, gudangId: string): Promise<{ baru: number, bekas: number, rusak: number, total: number }> {
        // Optimized: Use pre-calculated stock from BarangGudang instead of iterating all transactions
        const stock = await this.db.barangGudang.findUnique({
            where: {
                barangId_gudangId: { barangId, gudangId }
            },
            select: {
                stokBaru: true,
                stokBekas: true,
                stokRusak: true,
                stok: true
            }
        })

        if (!stock) {
            return { baru: 0, bekas: 0, rusak: 0, total: 0 }
        }

        return {
            baru: stock.stokBaru,
            bekas: stock.stokBekas,
            rusak: stock.stokRusak,
            total: stock.stok
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
