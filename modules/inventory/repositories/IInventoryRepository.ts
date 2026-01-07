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
    barangGudang: (BarangGudang & {
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
    isWorkOrderMaterial?: boolean
}

export interface UpdateBarangInput {
    kode?: string
    nama?: string
    satuan?: string
    isWorkOrderMaterial?: boolean
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
    tujuanPenggunaan?: string
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

// Gudang Types
export interface CreateGudangInput {
    kode: string
    nama: string
    lokasi?: string | null
    isActive?: boolean
    siteIds?: string[]  // Array of site IDs to connect
}

export interface UpdateGudangInput {
    kode?: string
    nama?: string
    lokasi?: string | null
    isActive?: boolean
}

// ... existing inputs ...

// Transfer Types
export interface CreateTransferInput {
    barangId: string
    dariGudangId: string
    keGudangId: string
    jumlah: number
    kondisi?: KondisiBarang
    keterangan?: string
    userId: string
    fotoBukti?: string[]
    fotoMetadata?: any
}

export interface UpdateTransferInput {
    keterangan?: string
}

export interface IInventoryRepository {
    // ... existing Barang methods ...

    // Transfer CRUD
    findAllTransfers(params?: {
        skip?: number
        take?: number
        barangId?: string
        dariGudangId?: string
        keGudangId?: string
        siteId?: string
    }): Promise<{ items: any[]; total: number }>

    findTransferById(id: string): Promise<any | null>

    createTransfer(data: CreateTransferInput): Promise<any>

    updateTransfer(id: string, data: UpdateTransferInput): Promise<any>

    deleteTransfer(id: string): Promise<void> // Revert transfer

    // ... existing Gudang methods ...

    // Gudang CRUD
    // Note: getAllGudang already exists, equivalent to findAllGudang
    findGudangById(id: string): Promise<Gudang | null>
    findGudangByKode(kode: string): Promise<Gudang | null>
    createGudang(data: CreateGudangInput): Promise<Gudang>
    updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang>
    deleteGudang(id: string): Promise<void> // Hard or soft delete implementation detail
    hasStockInGudang(id: string): Promise<boolean>

    // ... existing Stock methods ...
    findAllBarang(params?: {
        skip?: number
        take?: number
        search?: string
        gudangId?: string
        isWorkOrderMaterial?: boolean
        siteId?: string
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
    getAllGudang(params?: { siteId?: string }): Promise<Gudang[]>
    getStockBreakdown(barangId: string, gudangId: string): Promise<{ baru: number, bekas: number, rusak: number, total: number }>

    // History Queries
    getHistoryMasuk(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
        search?: string
        siteId?: string
    }): Promise<{ items: BarangMasukWithRelations[]; total: number }>

    getHistoryKeluar(params?: {
        skip?: number
        take?: number
        barangId?: string
        gudangId?: string
        startDate?: Date
        endDate?: Date
        search?: string
        siteId?: string
    }): Promise<{ items: BarangKeluarWithRelations[]; total: number }>
}
