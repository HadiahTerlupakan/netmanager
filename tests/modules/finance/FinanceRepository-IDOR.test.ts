import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { PemasukanRepository } from '@/modules/finance/repositories/PemasukanRepository'
import { PengeluaranRepository } from '@/modules/finance/repositories/PengeluaranRepository'
import { BillingAnalyticsRepository } from '@/modules/finance/repositories/BillingAnalyticsRepository'
import { getTenantIdFromContext } from '@/lib/tenant-context'
import type { PrismaClient } from '@prisma/client'

vi.mock('@/lib/tenant-context', () => ({
  getTenantIdFromContext: vi.fn()
}))

// Mock prisma-billing
vi.mock('@/lib/prisma-billing', () => ({
  prismaBilling: {
    invoice: {
      findMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    }
  }
}))

import { prismaBilling } from '@/lib/prisma-billing'

describe('Finance Repositories - IDOR Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PemasukanRepository', () => {
    it('should isolate findAll by tenantId', async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-X', isSuperAdmin: false })
      const repo = new PemasukanRepository(prismaMock as unknown as PrismaClient)
      
      // Inject the 'pemasukan' key to pass the check in repo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(prismaMock as any).pemasukan = { findMany: vi.fn().mockResolvedValue([]) }

      await repo.findAll()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prismaMock as any).pemasukan.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: 'tenant-X' }
      }))
    })
  })

  describe('PengeluaranRepository', () => {
    it('should isolate findAll by tenantId', async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-Y', isSuperAdmin: false })
      const repo = new PengeluaranRepository(prismaMock as unknown as PrismaClient)
      
      // Inject the 'pengeluaran' key
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(prismaMock as any).pengeluaran = { findMany: vi.fn().mockResolvedValue([]) }

      await repo.findAll()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prismaMock as any).pengeluaran.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: 'tenant-Y' }
      }))
    })
  })

  describe('BillingAnalyticsRepository', () => {
    it('should isolate getInvoicesWithPayments by tenantId', async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-Z', isSuperAdmin: false })
      const repo = new BillingAnalyticsRepository()

      await repo.getInvoicesWithPayments(new Date(), new Date())

      expect(prismaBilling.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-Z' })
      }))
    })

    it('should isolate groupBy top customers by tenantId', async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-Z', isSuperAdmin: false })
      const repo = new BillingAnalyticsRepository()
      
      prismaBilling.payment.groupBy.mockResolvedValue([])
      prismaMock.pelanggan.findMany.mockResolvedValue([])

      await repo.getTopCustomersByPayment(new Date(), new Date())

      expect(prismaBilling.payment.groupBy).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-Z' })
      }))
    })
  })
})
