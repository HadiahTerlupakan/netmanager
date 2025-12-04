export interface PemasukanPublic {
  id: string
  nomorBukti?: string
  tanggal: Date
  kategori: string
  deskripsi: string
  jumlah: string
  metodeBayar?: string
  catatan?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  updatedBy?: string
  createdByUser?: {
    id: string
    name?: string
    email?: string
  }
  updatedByUser?: {
    id: string
    name?: string
    email?: string
  }
}

export interface PemasukanCreateData {
  tanggal: Date | string
  nomorBukti?: string
  kategori: string
  deskripsi: string
  jumlah: number | string | bigint
  metodeBayar?: string
  catatan?: string
  createdBy?: string
}

export interface PemasukanUpdateData {
  tanggal?: Date | string
  nomorBukti?: string
  kategori?: string
  deskripsi?: string
  jumlah?: number | string | bigint
  metodeBayar?: string | null
  catatan?: string | null
  updatedBy?: string | null
}

export interface IPemasukanRepository {
  findAll(): Promise<PemasukanPublic[]>
  findById(id: string): Promise<PemasukanPublic | null>
  create(data: PemasukanCreateData): Promise<{ id: string }>
  update(id: string, data: PemasukanUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
  findByDateRange(startDate: Date, endDate: Date): Promise<PemasukanPublic[]>
  findByKategori(kategori: string): Promise<PemasukanPublic[]>
  aggregateTotal(): Promise<bigint>
  aggregateTotalByPeriod(month: number, year: number): Promise<bigint>
  groupByPeriode(): Promise<any[]>
  findIdsAndDates(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<{ id: string, tanggal: Date }[]>
  findByFilters(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<PemasukanPublic[]>
}

