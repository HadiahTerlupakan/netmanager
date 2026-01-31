/**
 * Inventory-related types untuk warehouse dan stock management
 */

import type { Timestamps } from './common';

// Gudang (Warehouse) types
export interface Gudang extends Timestamps {
  id: string;
  namaGudang: string;
  lokasi?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  kapasitas?: number;
  description?: string;
}

// Barang (Item/Product) types
export interface Barang extends Timestamps {
  id: string;
  namaBarang: string;
  kodeBarang: string;
  kategori?: string;
  satuan: string;
  hargaBeli?: number;
  hargaJual?: number;
  stokMinimal?: number;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
}

// Barang Gudang (Item in Warehouse)
export interface BarangGudang extends Timestamps {
  id: string;
  barangId: string;
  gudangId: string;
  stok: number;
  lokasi?: string;
  barang?: Barang;
  gudang?: Gudang;
}

// Barang Masuk (Incoming Stock)
export type BarangMasukStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface BarangMasuk extends Timestamps {
  id: string;
  nomorTransaksi: string;
  gudangId: string;
  barangId: string;
  jumlah: number;
  hargaSatuan?: number;
  totalHarga?: number;
  supplierId?: string;
  tanggalMasuk: Date;
  status: BarangMasukStatus;
  keterangan?: string;
  userId: string;
  approvedBy?: string;
  approvedAt?: Date;
  receiptUrl?: string;
}

// Barang Keluar (Outgoing Stock)
export type BarangKeluarStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface BarangKeluar extends Timestamps {
  id: string;
  nomorTransaksi: string;
  gudangId: string;
  barangId: string;
  jumlah: number;
  tujuan?: string;
  tanggalKeluar: Date;
  status: BarangKeluarStatus;
  keterangan?: string;
  userId: string;
  approvedBy?: string;
  approvedAt?: Date;
  workOrderId?: string;
}

// Transfer Antar Gudang (Inter-warehouse Transfer)
export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export interface TransferAntarGudang extends Timestamps {
  id: string;
  nomorTransfer: string;
  gudangAsalId: string;
  gudangTujuanId: string;
  barangId: string;
  jumlah: number;
  tanggalTransfer: Date;
  tanggalTerima?: Date;
  status: TransferStatus;
  keterangan?: string;
  requestedBy: string;
  approvedBy?: string;
  receivedBy?: string;
}

// Stock Opname (Stock Taking/Physical Count)
export type OpnameStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StockOpname extends Timestamps {
  id: string;
  nomorOpname: string;
  gudangId: string;
  tanggalOpname: Date;
  status: OpnameStatus;
  keterangan?: string;
  userId: string;
  approvedBy?: string;
  approvedAt?: Date;
  totalItems?: number;
  totalDiscrepancy?: number;
}

export interface StockOpnameDetail {
  id: string;
  stockOpnameId: string;
  barangId: string;
  stokSistem: number;
  stokFisik: number;
  selisih: number;
  keterangan?: string;
  photoUrl?: string;
}

// Restock Alert
export interface RestockAlert extends Timestamps {
  id: string;
  barangId: string;
  gudangId: string;
  currentStock: number;
  minStock: number;
  suggestedReorder: number;
  status: 'PENDING' | 'ORDERED' | 'RESOLVED' | 'IGNORED';
  notifiedAt?: Date;
}

// Restock Settings
export interface RestockSettings extends Timestamps {
  id: string;
  barangId: string;
  gudangId: string;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  isActive: boolean;
}

export interface PhotoMetadata {
  url: string;
  filename: string;
  size: number;
  format: string;
  uploadedAt: string;
  uploadedBy: string;
  caption?: string;
}

// Summary types for dashboards
export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
}

export interface StockMovementSummary {
  totalIncoming: number;
  totalOutgoing: number;
  totalTransfers: number;
  netChange: number;
}

export interface GudangSummary {
  gudangId: string;
  namaGudang: string;
  totalItems: number;
  totalValue: number;
  utilizationRate?: number;
}

export interface RestockSummary {
  totalAlerts: number;
  criticalItems: number;
  pendingOrders: number;
  estimatedValue: number;
}

// Stock Movement for analytics
export interface StockMovement {
  barangId: string;
  gudangId: string;
  type: 'IN' | 'OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  quantity: number;
  date: Date;
  referenceId?: string;
  referenceType?: string;
}

// Inventory valuation
export interface InventoryValuation {
  barangId: string;
  gudangId: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  valuationMethod: 'FIFO' | 'LIFO' | 'AVERAGE';
  asOfDate: Date;
}
