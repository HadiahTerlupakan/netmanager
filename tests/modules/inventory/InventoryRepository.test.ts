import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { InventoryRepository } from '@/modules/inventory/repositories/InventoryRepository'

// Note: InventoryRepository uses an internal `this.db` instance.
// For proper testing, we would need to inject the prisma client.
// These tests verify the expected behavior using mocked prisma calls.

describe('InventoryRepository', () => {
  let repository: InventoryRepository

  beforeEach(() => {
    // Create repository - it will use the mocked prisma from setup
    repository = new InventoryRepository()
  })

  describe('createBarang', () => {
    it('should create new barang successfully', async () => {
      const input = {
        kode: 'BRG-001',
        nama: 'Kabel Fiber',
        satuan: 'Meter',
        minStock: 100
      }

      const mockCreatedBarang = {
        id: 'barang-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prismaMock.barang.create.mockResolvedValueOnce(mockCreatedBarang as any)

      const result = await repository.createBarang(input)

      expect(result).toBeDefined()
    })
  })

  describe('findBarangByKode', () => {
    it('should find barang by kode using findUnique', async () => {
      const mockBarang = {
        id: 'barang-1',
        kode: 'BRG-001',
        nama: 'Kabel Fiber',
        barangGudang: []
      }

      prismaMock.barang.findUnique.mockResolvedValueOnce(mockBarang as any)

      const result = await repository.findBarangByKode('BRG-001')

      expect(result).toBeDefined()
      expect(result?.kode).toBe('BRG-001')
    })

    it('should return null if barang not found', async () => {
      prismaMock.barang.findUnique.mockResolvedValueOnce(null)

      const result = await repository.findBarangByKode('NONEXISTENT')

      expect(result).toBeNull()
    })
  })

  describe('getStockLevel', () => {
    it('should return stock from barangGudang', async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce({
        id: 'bg-1',
        stok: 50
      } as any)

      const result = await repository.getStockLevel('barang-1', 'gudang-1')

      expect(result).toBe(50)
    })

    it('should return 0 if no stock record exists', async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce(null)

      const result = await repository.getStockLevel('barang-1', 'gudang-1')

      expect(result).toBe(0)
    })
  })

  describe('getStockBreakdown', () => {
    it('should calculate stock breakdown from masuk and keluar records', async () => {
      // Mock barang masuk
      prismaMock.barangMasuk.findMany.mockResolvedValueOnce([
        { kondisi: 'BARU', jumlah: 20 },
        { kondisi: 'BEKAS', jumlah: 15 },
        { kondisi: 'RUSAK', jumlah: 5 }
      ] as any)

      // Mock barang keluar (empty - no items taken out)
      prismaMock.barangKeluar.findMany.mockResolvedValueOnce([])

      const result = await repository.getStockBreakdown('barang-1', 'gudang-1')

      expect(result.baru).toBe(20)
      expect(result.bekas).toBe(15)
      expect(result.rusak).toBe(5)
      expect(result.total).toBe(40)
    })

    it('should subtract keluar from masuk', async () => {
      prismaMock.barangMasuk.findMany.mockResolvedValueOnce([
        { kondisi: 'BARU', jumlah: 50 }
      ] as any)

      prismaMock.barangKeluar.findMany.mockResolvedValueOnce([
        { kondisi: 'BARU', jumlah: 15 }
      ] as any)

      const result = await repository.getStockBreakdown('barang-1', 'gudang-1')

      expect(result.baru).toBe(35) // 50 - 15
      expect(result.total).toBe(35)
    })
  })

  describe('getAllGudang', () => {
    it('should return all active gudang', async () => {
      const mockGudang = [
        { id: 'gudang-1', nama: 'Gudang Pusat', isActive: true },
        { id: 'gudang-2', nama: 'Gudang Cabang', isActive: true }
      ]

      prismaMock.gudang.findMany.mockResolvedValueOnce(mockGudang as any)

      const result = await repository.getAllGudang()

      expect(result).toHaveLength(2)
    })
  })

  describe('hasStockInGudang', () => {
    it('should return true if gudang has stock', async () => {
      prismaMock.barangGudang.count.mockResolvedValueOnce(5)

      const result = await repository.hasStockInGudang('gudang-1')

      expect(result).toBe(true)
    })

    it('should return false if gudang has no stock', async () => {
      prismaMock.barangGudang.count.mockResolvedValueOnce(0)

      const result = await repository.hasStockInGudang('gudang-1')

      expect(result).toBe(false)
    })
  })
})
