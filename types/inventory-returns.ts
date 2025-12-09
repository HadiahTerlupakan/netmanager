import type { BarangKeluar, BarangMasuk, Barang, Gudang, User } from '@prisma/client'

// Base types for inventory returns
export interface BarangKeluarWithRelations extends BarangKeluar {
  barang: Pick<Barang, 'id' | 'kode' | 'nama' | 'satuan'>
  gudang: Pick<Gudang, 'id' | 'kode' | 'nama'>
  user?: Pick<User, 'id' | 'name' | 'email'>
}

export interface BarangMasukWithRelations extends BarangMasuk {
  barang: Pick<Barang, 'id' | 'kode' | 'nama' | 'satuan'>
  gudang: Pick<Gudang, 'id' | 'kode' | 'nama'>
}

// Return transaction types
export interface BarangReturn {
  id: string
  barangKeluarId: string
  barangMasukId?: string
  employeeId: string
  tanggalPengembalian: Date
  jumlahDikembalikan: number
  kondisiPengembalian: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan?: string
  fotoBukti?: string[]
  fotoMetadata?: any
  createdAt: Date
  updatedAt: Date
}

// API Request/Response types
export interface CreateReturnRequest {
  barangKeluarId: string
  jumlahDikembalikan: number
  kondisiPengembalian: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan?: string
  purpose?: string
 fotoBukti?: string[]
  fotoMetadata?: any
}

export interface CreateReturnResponse {
  message: string
  returnId: string
  data: BarangReturn
}

export interface EmployeeReturnItem {
  id: string // BarangKeluar ID
  barang: Pick<Barang, 'id' | 'kode' | 'nama' | 'satuan'>
  gudang: Pick<Gudang, 'id' | 'kode' | 'nama'>
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  tanggal: Date
  keterangan?: string
  purpose?: string
  isHilang: boolean
  fotoBukti?: string[]
}

export interface EmployeeReturnsResponse {
  returns: EmployeeReturnItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ReturnDetailResponse {
  barangKeluar: BarangKeluarWithRelations
  canReturn: boolean
  maxReturnableQuantity: number
  returnHistory?: BarangReturn[]
}

// Photo upload types
export interface ReturnPhotoUploadRequest {
  returnId: string
  photos: File[]
}

export interface ReturnPhotoUploadResponse {
  success: boolean
  message: string
  data: {
    urls: string[]
    returnId: string
    count: number
  }
}

// Query parameters
export interface EmployeeReturnsQuery {
  page?: string
  limit?: string
  search?: string
  barangId?: string
  gudangId?: string
  kondisi?: string
}

export interface ReturnDetailQuery {
  includeHistory?: string
}

// Validation types
export interface ReturnValidationError {
  field: string
  message: string
}

export interface ReturnValidationResult {
  isValid: boolean
  errors: ReturnValidationError[]
}

// Stock calculation types
export interface StockUpdateResult {
  previousStock: number
  newStock: number
  stockChange: number
  gudangId: string
  barangId: string
}

// Audit trail types
export interface ReturnAuditLog {
  id: string
  returnId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  userId: string
  userName?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

// All types are already exported above, no need for re-export
