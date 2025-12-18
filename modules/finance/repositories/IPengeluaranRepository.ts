export interface PengeluaranPublic {
  id: string
  nomorBukti?: string
  tanggal: Date
  tipePengeluaran?: 'CAPEX' | 'OPEX'
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

export interface PengeluaranCreateData {
  tanggal: Date | string
  nomorBukti?: string
  tipePengeluaran?: 'CAPEX' | 'OPEX'
  kategori: string
  deskripsi: string
  jumlah: number | string | bigint
  metodeBayar?: string
  catatan?: string
  createdBy?: string
}

export interface PengeluaranUpdateData {
  tanggal?: Date | string
  nomorBukti?: string
  tipePengeluaran?: 'CAPEX' | 'OPEX'
  kategori?: string
  deskripsi?: string
  jumlah?: number | string | bigint
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
  aggregateTotal(): Promise<bigint>
  aggregateTotalByPeriod(month: number, year: number): Promise<bigint>
  aggregateTotalByTipe(tipePengeluaran: 'CAPEX' | 'OPEX'): Promise<bigint>
  aggregateTotalByTipeAndPeriod(tipePengeluaran: 'CAPEX' | 'OPEX', month: number, year: number): Promise<bigint>
  groupByPeriode(): Promise<any[]>
  findIdsAndDates(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<{ id: string, tanggal: Date }[]>
  findByFilters(startDate?: Date, endDate?: Date, category?: string, paymentMethod?: string, searchDescription?: string): Promise<PengeluaranPublic[]>
}

