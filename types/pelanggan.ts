export type PelangganData = {
    id: string
    idPelanggan: string
    nama: string
    username: string
    tipe: 'REGULER' | 'NON_REGULER'
    hargaPaket?: {
        name: string
        harga: number
    } | null
    tanggalAktif: string
    jatuhTempo: string
    status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
    alamat?: string | null
    noTelp?: string | null
    email?: string | null
}

export type TagihanItem = {
    id: string
    bulan: string
    tahun: number
    jumlah: number
    jatuhTempo: string
    status: 'LUNAS' | 'BELUM_LUNAS' | 'TERLAMBAT'
    tanggalBayar?: string
}
