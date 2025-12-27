import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { AutomaticBillingService } from '@/modules/finance/services/AutomaticBillingService'

// Mock notification
vi.mock('@/modules/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-id' })
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    logActivity: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('AutomaticBillingService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01'))
  })

  describe('generateDailyInvoices', () => {
    it('should skip if no active customers found', async () => {
      // Mock settings
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_INVOICE_OTOMATIS',
        value: '5'
      } as any)

      // Mock: No active customers
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([])

      await AutomaticBillingService.generateDailyInvoices()

      // No invoices should be created
      expect(prismaMock.invoice.create).not.toHaveBeenCalled()
    })

    it('should generate invoice for customer with matching due date', async () => {
      // Set date to Jan 1, daysBeforeDue = 5, so target = Jan 6
      vi.setSystemTime(new Date('2024-01-01'))

      // Mock settings
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_INVOICE_OTOMATIS',
        value: '5'
      } as any)

      // Mock: Active customer with jatuhTempo on day 6
      const mockCustomer = {
        id: 'customer-1',
        nama: 'Test Customer',
        userId: 'user-1',
        jatuhTempo: new Date('2024-01-06'),
        usePPN: true,
        hargaPaket: {
          name: 'Paket 10 Mbps',
          harga: 100000n,
          usePPN: true,
          ppnPercentage: 11
        }
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([mockCustomer] as any)

      // Mock: No existing invoice
      prismaMock.invoice.findFirst.mockResolvedValueOnce(null)

      // Mock: Invoice count
      prismaMock.invoice.count.mockResolvedValueOnce(0)

      // Mock: Create invoice
      prismaMock.invoice.create.mockResolvedValueOnce({
        id: 'invoice-1',
        invoiceNumber: 'INV/2024/01/0001'
      } as any)

      await AutomaticBillingService.generateDailyInvoices()

      expect(prismaMock.invoice.create).toHaveBeenCalled()
    })

    it('should skip if invoice already exists for the period', async () => {
      vi.setSystemTime(new Date('2024-01-01'))

      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_INVOICE_OTOMATIS',
        value: '5'
      } as any)

      const mockCustomer = {
        id: 'customer-1',
        nama: 'Test Customer',
        jatuhTempo: new Date('2024-01-06'),
        hargaPaket: { name: 'Paket', harga: 100000n }
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([mockCustomer] as any)

      // Mock: Invoice already exists
      prismaMock.invoice.findFirst.mockResolvedValueOnce({
        id: 'existing-invoice'
      } as any)

      await AutomaticBillingService.generateDailyInvoices()

      // Invoice should not be created
      expect(prismaMock.invoice.create).not.toHaveBeenCalled()
    })

    it('should calculate PPN correctly', async () => {
      vi.setSystemTime(new Date('2024-01-01'))

      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_INVOICE_OTOMATIS',
        value: '5'
      } as any)

      const mockCustomer = {
        id: 'customer-1',
        nama: 'Test Customer',
        userId: 'user-1',
        jatuhTempo: new Date('2024-01-06'),
        usePPN: true,
        hargaPaket: {
          name: 'Paket 10 Mbps',
          harga: 100000n, // 100.000
          usePPN: true,
          ppnPercentage: 11 // 11%
        }
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([mockCustomer] as any)
      prismaMock.invoice.findFirst.mockResolvedValueOnce(null)
      prismaMock.invoice.count.mockResolvedValueOnce(0)
      prismaMock.invoice.create.mockResolvedValueOnce({ id: 'invoice-1' } as any)

      await AutomaticBillingService.generateDailyInvoices()

      // Check that invoice was created with correct tax calculation
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 100000n,
            // Tax: 100000 * 11% = 11000 (approximately, depending on rounding)
            taxAmount: expect.any(BigInt),
            totalAmount: expect.any(BigInt)
          })
        })
      )
    })
  })
})
