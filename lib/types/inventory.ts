// Shared types for inventory module

export interface StockOpnameRecord {
    id: string
    barangId: string
    gudangId: string
    stokFisik: number
    stokSistem: number
    selisih: number
    keterangan: string | null
    kondisiBaik: number
    kondisiRusak: number
    kondisiExpire: number
    lokasiPenyimpanan: string | null
    nomorRak: string | null
    nomorBox: string | null
    pic: string | null
    suhuPenyimpanan: number | null
    kelembaban: number | null
    tanggalExpire: string | null
    nomorBatch: string | null
    catatanDetail: string | null
    createdAt: string
    barang: {
        id: string
        kode: string
        nama: string
        satuan: string
    }
    gudang: {
        id: string
        kode: string
        nama: string
    }
}

// For form submissions (has optional id for new records)
export interface StockOpnameFormData {
    id?: string
    barangId: string
    gudangId: string
    stokFisik: number
    stokSistem?: number
    selisih?: number
    keterangan?: string | null
    kondisiBaik: number
    kondisiRusak: number
    kondisiExpire: number
    lokasiPenyimpanan?: string | null
    nomorRak?: string | null
    nomorBox?: string | null
    pic?: string | null
    suhuPenyimpanan?: number | null
    kelembaban?: number | null
    tanggalExpire?: string | null
    nomorBatch?: string | null
    catatanDetail?: string | null
}
