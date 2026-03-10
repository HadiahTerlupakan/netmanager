import { describe, expect, it } from 'vitest'
import { GET as getPurchaseOrders, POST as postPurchaseOrders } from '@/app/api/procurement/purchase-orders/route'
import { GET as getPurchaseOrderById, PUT as putPurchaseOrderById, DELETE as deletePurchaseOrderById } from '@/app/api/procurement/purchase-orders/[id]/route'
import { PATCH as patchPurchaseOrderStatus } from '@/app/api/procurement/purchase-orders/[id]/status/route'
import { POST as postGeneratePurchaseOrders } from '@/app/api/procurement/purchase-orders/generate/route'
import { GET as getPurchaseRequests } from '@/app/api/procurement/purchase-requests/route'
import { GET as getPurchaseRequestById, PATCH as patchPurchaseRequestById } from '@/app/api/procurement/purchase-requests/[id]/route'
import { GET as getAvailablePurchaseRequests } from '@/app/api/procurement/purchase-requests/available/route'
import { GET as getSuppliers, POST as postSuppliers } from '@/app/api/procurement/suppliers/route'
import { GET as getSupplierById, PUT as putSupplierById, DELETE as deleteSupplierById } from '@/app/api/procurement/suppliers/[id]/route'
import { POST as postLegacyInventoryProcurementRequest } from '@/app/api/inventory/procurement/purchase-request/route'

const expectDisabled = async (response: Response) => {
  const json = await response.json()

  expect(response.status).toBe(410)
  expect(json).toEqual({ error: 'Endpoint procurement dinonaktifkan' })
}

describe('disabled procurement api routes', () => {
  it('disables first-wave purchase order endpoints', async () => {
    await expectDisabled(await getPurchaseOrders())
    await expectDisabled(await postPurchaseOrders())
    await expectDisabled(await getPurchaseOrderById())
    await expectDisabled(await putPurchaseOrderById())
    await expectDisabled(await deletePurchaseOrderById())
  })

  it('disables second-wave manual purchase order generation endpoint', async () => {
    await expectDisabled(await postGeneratePurchaseOrders())
  })

  it('disables first-wave purchase request endpoints', async () => {
    await expectDisabled(await getPurchaseRequests())
    await expectDisabled(await getAvailablePurchaseRequests())
    await expectDisabled(await getPurchaseRequestById())
    await expectDisabled(await patchPurchaseRequestById())
  })

  it('disables the remaining procurement purchase order status lifecycle endpoint', async () => {
    await expectDisabled(await patchPurchaseOrderStatus())
  })

  it('disables first-wave supplier endpoints', async () => {
    await expectDisabled(await getSuppliers())
    await expectDisabled(await postSuppliers())
    await expectDisabled(await getSupplierById())
    await expectDisabled(await putSupplierById())
    await expectDisabled(await deleteSupplierById())
  })

  it('disables the legacy inventory procurement compatibility route', async () => {
    await expectDisabled(await postLegacyInventoryProcurementRequest())
  })
})
