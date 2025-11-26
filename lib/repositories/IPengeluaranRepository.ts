export interface PengeluaranPublic {
  id: string
  tanggal: Date
  kategori: string
  deskripsi: string
  jumlah: number
  metodeBayar: string | null
  catatan: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
}

export interface PengeluaranCreateData {
  tanggal: Date | string
  kategori: string
  deskripsi: string
  jumlah: number
  metodeBayar?: string | null
  catatan?: string | null
  createdBy?: string | null
}

export interface PengeluaranUpdateData {
  tanggal?: Date | string
  kategori?: string
  deskripsi?: string
  jumlah?: number
  metodeBayar?: string | null
  catatan?: string | null
  updatedBy?: string | null
}

export interface IPengeluaranRepository {
  findAll(): Promise<PengeluaranPublic[]>
  findById(id: string): Promise<PengeluaranPublic | null>
  create(data: PengeluaranCreateData): Promise<{ id: string }>
  update(id: string, data: PengeluaranUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
  findByDateRange(startDate: Date, endDate: Date): Promise<PengeluaranPublic[]>
  findByKategori(kategori: string): Promise<PengeluaranPublic[]>
}

