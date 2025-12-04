import { TagihanStatus } from '@prisma/client'

export interface TagihanSelect {
  id: boolean
  pelangganId: boolean
  noTagihan: boolean
  periodeBulan: boolean
  periodeTahun: boolean
  subtotal: boolean
  diskon: boolean
  ppn: boolean
  biayaInstalasi: boolean
  biayaSewaPerangkat: boolean
  biayaLainnya: boolean
  total: boolean
  status: boolean
  jatuhTempo: boolean
  tanggalBayar: boolean
  metodePembayaran: boolean
  catatan: boolean
  createdAt: boolean
  updatedAt: boolean
}

export interface TagihanCreateData {
  pelangganId: string
  noTagihan: string
  periodeBulan: number
  periodeTahun: number
  subtotal: number
  diskon: number
  ppn: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  total: number
  jatuhTempo: Date
  catatan?: string | null
}

export interface TagihanUpdateData {
  status?: TagihanStatus
  jatuhTempo?: Date
  subtotal?: number
  diskon?: number
  ppn?: number
  biayaInstalasi?: number
  biayaSewaPerangkat?: number
  biayaLainnya?: number
  total?: number
  tanggalBayar?: Date | null
  metodePembayaran?: string | null
  catatan?: string | null
}

export interface TagihanPublic {
  id: string
  pelangganId: string
  noTagihan: string
  periodeBulan: number
  periodeTahun: number
  subtotal: number
  diskon: number
  ppn: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  total: number
  status: TagihanStatus
  jatuhTempo: Date
  tanggalBayar: Date | null
  metodePembayaran: string | null
  catatan: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TagihanWithPelanggan extends TagihanPublic {
  pelanggan: {
    id: string
    idPelanggan: string
    nama: string
    email: string | null
    alamat?: string | null
    noTelp?: string | null
    hargaPaket?: {
      name: string
      harga: number
    } | null
  }
}

export interface ITagihanRepository {
  findAll(): Promise<TagihanPublic[]>
  findById(id: string): Promise<TagihanWithPelanggan | null>
  findByNoTagihan(noTagihan: string): Promise<TagihanPublic | null>
  findByPelangganId(pelangganId: string): Promise<TagihanPublic[]>
  findByPelangganIdWithPelanggan(pelangganId: string): Promise<TagihanWithPelanggan[]>
  findByStatus(status: TagihanStatus): Promise<TagihanPublic[]>
  findByPeriode(periodeBulan: number, periodeTahun: number): Promise<TagihanPublic[]>
  findByPelangganAndPeriode(pelangganId: string, periodeBulan: number, periodeTahun: number): Promise<TagihanPublic | null>
  create(data: TagihanCreateData): Promise<{ id: string }>
  update(id: string, data: TagihanUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
  countByStatus(status: TagihanStatus): Promise<number>
  countByPelangganId(pelangganId: string): Promise<number>
  countByPeriode(periodeBulan: number, periodeTahun: number): Promise<number>
  countByPeriodeAndTanggal(periodeBulan: number, periodeTahun: number, tanggal: Date): Promise<number>
  findTerlambat(): Promise<TagihanPublic[]>
  aggregateTotalByStatus(status: TagihanStatus): Promise<number>
  aggregateTotalByStatusAndPeriod(status: TagihanStatus, month: number, year: number): Promise<number>
  groupByPeriode(): Promise<any[]>
}

