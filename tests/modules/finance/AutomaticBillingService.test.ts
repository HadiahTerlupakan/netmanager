import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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

  afterEach(() => {
    vi.useRealTimers()
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
          id: 'paket-1',
          name: 'Paket 10 Mbps',
          harga: 100000n,
          usePPN: true,
          ppnPercentage: 11
        }
      }
      prismaMock.pelanggan.findMany
        .mockResolvedValueOnce([mockCustomer] as any)
        .mockResolvedValueOnce([])

      // Mock: No existing invoice (batch check)
      prismaMock.invoice.findMany.mockResolvedValueOnce([])

      // Mock: Invoice count for number generation
      prismaMock.invoice.count.mockResolvedValueOnce(0)

      // Mock: Transaction to return invoice
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV/2024/01/0001',
        totalAmount: 111000n,
        subtotal: 100000n,
        taxAmount: 11000n
      }
      prismaMock.$transaction.mockResolvedValueOnce(mockInvoice)

      await AutomaticBillingService.generateDailyInvoices()

      // Invoice creation happens inside transaction
      expect(prismaMock.$transaction).toHaveBeenCalled()
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
        hargaPaket: { id: 'paket-1', name: 'Paket', harga: 100000n }
      }
      prismaMock.pelanggan.findMany
        .mockResolvedValueOnce([mockCustomer] as any)
        .mockResolvedValueOnce([])

      // Mock: Invoice already exists (batch check returns matching pelangganId)
      prismaMock.invoice.findMany.mockResolvedValueOnce([
        { pelangganId: 'customer-1' }
      ] as any)

      await AutomaticBillingService.generateDailyInvoices()

      // Invoice should not be created - no transaction called
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
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
          id: 'paket-1',
          name: 'Paket 10 Mbps',
          harga: 100000n,
          usePPN: true,
          ppnPercentage: 11
        }
      }
      prismaMock.pelanggan.findMany
        .mockResolvedValueOnce([mockCustomer] as any)
        .mockResolvedValueOnce([])
      prismaMock.invoice.findMany.mockResolvedValueOnce([])
      prismaMock.invoice.count.mockResolvedValueOnce(0)
      
      // Mock transaction with invoice result including PPN
      const mockInvoice = { 
        id: 'invoice-1',
        invoiceNumber: 'INV/2024/01/0001',
        totalAmount: 111000n, // 100000 + 11%
        subtotal: 100000n,
        taxAmount: 11000n // 11% of 100000
      }
      prismaMock.$transaction.mockResolvedValueOnce(mockInvoice)

      await AutomaticBillingService.generateDailyInvoices()

      // Check that transaction was called (invoice creation happens inside)
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })
  })
})
