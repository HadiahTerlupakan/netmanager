import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'

import { PelangganService, type CreatePelangganInput } from '@/modules/pelanggan/services/PelangganService'
import type { Pelanggan, HargaPaket } from '@prisma/client'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockResolvedValue(true),
}))

// Mock radius-sync-hooks
vi.mock('@/lib/hooks/radius-sync-hooks', () => ({
  afterCustomerCreate: vi.fn().mockResolvedValue({ success: true })
}))

describe('PelangganService', () => {
  let service: PelangganService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PelangganService()
  })

  describe('createPelanggan', () => {
    const validInput: CreatePelangganInput = {
      idPelanggan: '12345678',
      nama: 'Test Customer',
      username: 'testuser',
      password: 'pppoe123',
      passwordLogin: 'portal123',
      hargaPaketId: 'paket-001',
      tipe: 'REGULER',
      tanggalAktif: '2024-01-01',
      jatuhTempo: '2024-02-01',
      status: 'AKTIF'
    }

    it('should validate ID Pelanggan must be 8 digits', async () => {
      const invalidInput = { ...validInput, idPelanggan: '1234' }

      await expect(service.createPelanggan(invalidInput))
        .rejects.toThrow('ID Pelanggan harus 8 digit angka')
    })

    it('should validate ID Pelanggan must contain only numbers', async () => {
      const invalidInput = { ...validInput, idPelanggan: '1234abcd' }

      await expect(service.createPelanggan(invalidInput))
        .rejects.toThrow('ID Pelanggan harus 8 digit angka')
    })

    it('should reject duplicate ID Pelanggan', async () => {
      // Mock: ID already exists - checkGlobalIdentifier uses findFirst
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce({
        id: 'existing-id',
        idPelanggan: '12345678'
      } as unknown as Pelanggan)

      await expect(service.createPelanggan(validInput))
        .rejects.toThrow('ID Pelanggan sudah digunakan')
    })

    it('should reject duplicate username', async () => {
      // Mock: ID not exists
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce(null)
      // Mock: Username exists - findByUsername uses findFirst
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce({
        id: 'existing-id',
        username: 'testuser'
      } as unknown as Pelanggan)

      await expect(service.createPelanggan(validInput))
        .rejects.toThrow('Username sudah digunakan')
    })

    it('should reject if HargaPaket not found', async () => {
      // Mock: ID not exists
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce(null)
      // Mock: Username not exists
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce(null)
      // Mock: HargaPaket not found
      prismaMock.hargaPaket.findUnique.mockResolvedValueOnce(null)

      await expect(service.createPelanggan(validInput))
        .rejects.toThrow('Harga Paket tidak ditemukan')
    })

    it('should create pelanggan successfully with valid input', async () => {
      const mockPelanggan = {
        id: 'new-pelanggan-id',
        idPelanggan: '12345678',
        nama: 'Test Customer',
        username: 'testuser',
        hargaPaket: { name: 'Paket 10 Mbps', harga: 100000 }
      }

      // Mock: ID not exists
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce(null)
      // Mock: Username not exists
      prismaMock.pelanggan.findFirst.mockResolvedValueOnce(null)
      // Mock: HargaPaket exists
      prismaMock.hargaPaket.findUnique.mockResolvedValueOnce({ id: 'paket-001' } as unknown as HargaPaket)
      // Mock: Create pelanggan
      prismaMock.pelanggan.create.mockResolvedValueOnce(mockPelanggan as unknown as Pelanggan)

      const result = await service.createPelanggan(validInput)

      expect(result).toBeDefined()
      expect(result.idPelanggan).toBe('12345678')
    })
  })

  describe('deletePelanggan', () => {
    it('should throw error if pelanggan not found', async () => {
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce(null)

      await expect(service.deletePelanggan('non-existent-id'))
        .rejects.toThrow('Pelanggan tidak ditemukan')
    })

    it('should delete pelanggan successfully', async () => {
      const mockPelanggan = { id: 'pelanggan-id', nama: 'Test' }
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce(mockPelanggan as unknown as Pelanggan)
      prismaMock.pelanggan.delete.mockResolvedValueOnce(mockPelanggan as unknown as Pelanggan)

      const result = await service.deletePelanggan('pelanggan-id')

      expect(result.id).toBe('pelanggan-id')
      expect(prismaMock.pelanggan.delete).toHaveBeenCalledWith({
        where: { id: 'pelanggan-id' }
      })
    })
  })

  describe('getPelanggan', () => {
    it('should return null if pelanggan not found', async () => {
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce(null)

      const result = await service.getPelanggan('non-existent-id')

      expect(result).toBeNull()
    })

    it('should return pelanggan if found', async () => {
      const mockPelanggan = { id: 'pelanggan-id', nama: 'Test Customer' }
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce(mockPelanggan as unknown as Pelanggan)

      const result = await service.getPelanggan('pelanggan-id')

      expect(result).toBeDefined()
      expect(result?.id).toBe('pelanggan-id')
    })
  })

  describe('changePassword', () => {
    it('should hash new customer password with cost factor 12', async () => {
      prismaMock.pelanggan.findUnique.mockResolvedValueOnce({
        passwordHash: 'existing_hash',
      } as unknown as Pelanggan)

      prismaMock.pelanggan.update.mockResolvedValueOnce({
        id: 'pelanggan-id',
        noTelp: null,
        is2FAEnabled: false,
        isBillNotifEnabled: true,
        isPromoEnabled: true,
        updatedAt: new Date(),
      } as unknown as Pelanggan)

      await service.changePassword('pelanggan-id', 'current-password', 'new-password')

      const { hash } = await import('bcryptjs')
      expect(hash).toHaveBeenLastCalledWith('new-password', 12)
    })
  })
})
