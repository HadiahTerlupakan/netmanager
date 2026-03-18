import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../setup'

import { POST } from '@/app/api/scheduler/restock-check/route'

describe('restock check route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret-1'

    prismaMock.restockSettings.findMany.mockResolvedValue([
      {
        barangId: 'barang-1',
        gudangId: 'gudang-1',
        minStok: 10,
        maxStok: 20,
        barang: { id: 'barang-1', kode: 'BRG1', nama: 'Modem', satuan: 'pcs' },
        gudang: { id: 'gudang-1', kode: 'GD1', nama: 'Gudang Utama' },
      },
    ])
    prismaMock.barangGudang.findUnique.mockResolvedValue({ stok: 0 })
    prismaMock.restockAlerts.findFirst.mockResolvedValue(null)
    prismaMock.restockAlerts.create.mockResolvedValue({ id: 'alert-1' })
    prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1', email: 'admin@example.com' }])
    prismaMock.notifications.createMany.mockResolvedValue({ count: 1 })
  })

  it('creates inventory alert notifications for concrete recipients instead of orphan records', async () => {
    const response = await POST(new NextRequest('http://localhost/api/scheduler/restock-check', {
      method: 'POST',
      headers: { authorization: 'Bearer secret-1' },
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.notifications.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'ALERT',
          userId: 'admin-1',
          sourceType: 'INVENTORY',
          sourceId: expect.any(String),
        })
      ])
    })
    expect(json.notificationsSent).toBe(1)
  })
})
