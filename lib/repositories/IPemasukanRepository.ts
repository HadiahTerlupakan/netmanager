export interface PemasukanPublic {
  id: string
  tanggal: Date
  kategori: string
  deskripsi: string
  jumlah: bigint | string // BigInt dari Prisma, string untuk JSON serialization
  metodeBayar: string | null
  catatan: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
}

export interface PemasukanCreateData {
  tanggal: Date | string
  kategori: string
  deskripsi: string
  jumlah: number | bigint | string // Accept number, bigint, or string
  metodeBayar?: string | null
  catatan?: string | null
  createdBy?: string | null
}

export interface PemasukanUpdateData {
  tanggal?: Date | string
  kategori?: string
  deskripsi?: string
  jumlah?: number | bigint | string
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
  groupByPeriode(): Promise<any[]>
  findIdsAndDates(startDate?: Date, endDate?: Date): Promise<{ id: string, tanggal: Date }[]>
}

