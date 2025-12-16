import type {
    Barang,
    BarangMasuk,
    BarangKeluar,
    BarangGudang,
    Gudang,
    KondisiBarang
} from '@prisma/client'

// Extended types including relations
export type BarangWithStock = Barang & {
    stok: (BarangGudang & {
        gudang: Gudang
    })[]
}

export type BarangMasukWithRelations = BarangMasuk & {
    barang: Barang
    gudang: Gudang
    user?: { id: string; name: string | null } | null
}

export type BarangKeluarWithRelations = BarangKeluar & {
    barang: Barang
    gudang: Gudang
    user?: { id: string; name: string | null } | null
}

// Input types
export interface CreateBarangInput {
    kode: string
    nama: string
    satuan: string
}

export interface UpdateBarangInput {
    kode?: string
    nama?: string
    satuan?: string
}

export interface CreateBarangMasukInput {
    barangId: string
    gudangId: string
    jumlah: number
    kondisi?: KondisiBarang
    keterangan?: string
    fotoBukti?: string[]
    fotoMetadata?: any
    userId?: string
    tanggal?: Date
}

export interface CreateBarangKeluarInput {
    barangId: string
    gudangId: string
    jumlah: number
    kondisi: KondisiBarang
    keterangan?: string
    isHilang?: boolean
    userId?: string
    fotoBukti?: string[]
    fotoMetadata?: any
    tanggal?: Date
}

// Extended detailed type
export type BarangDetail = BarangWithStock & {
    masuk: BarangMasukWithRelations[]
    keluar: BarangKeluarWithRelations[]
    // opname usually has similar structure
    opname: any[]
}

export interface IInventoryRepository {
    // Barang CRUD
    findAllBarang(params?: {
        skip?: number
        take?: number
        search?: string
        gudangId?: string
    }): Promise<{ items: BarangWithStock[]; total: number }>

    findBarangById(id: string): Promise<BarangWithStock | null>
    findBarangDetail(id: string): Promise<BarangDetail | null>
    findBarangByKode(kode: string): Promise<BarangWithStock | null>
    createBarang(data: CreateBarangInput): Promise<Barang>
    updateBarang(id: string, data: UpdateBarangInput): Promise<Barang>
    deleteBarang(id: string): Promise<void>

    // Stock Operations
    addStock(data: CreateBarangMasukInput): Promise<BarangMasuk>
    removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar>

    // Stock Queries
    getStockLevel(barangId: string, gudangId: string): Promise<number>
    getAllGudang(): Promise<Gudang[]>
    getStockBreakdown(barangId: string, gudangId: string): Promise<{ baru: number, bekas: number, rusak: number, total: number }>

    // History Queries
    getHistoryMasuk(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
    }): Promise<{ items: BarangMasukWithRelations[]; total: number }>

    getHistoryKeluar(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
    }): Promise<{ items: BarangKeluarWithRelations[]; total: number }>
}
