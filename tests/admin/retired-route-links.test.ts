import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')

const fileContents = (relativePath: string) =>
  readFileSync(path.join(projectRoot, relativePath), 'utf8')

describe('live admin screens do not navigate to retired routes', () => {
  it('retargets remaining asset flows away from the retired asset list', () => {
    const createAssetForm = fileContents('components/inventory/assets/CreateAssetForm.tsx')
    const assetDetailPage = fileContents('app/admin/inventory/assets/[id]/page.tsx')

    expect(createAssetForm).not.toContain("'/admin/inventory/assets'")
    expect(createAssetForm).not.toContain('"/admin/inventory/assets"')
    expect(assetDetailPage).not.toContain('href="/admin/inventory/assets"')
  })

  it('retargets remaining direct-url procurement flows away from the retired purchase orders list', () => {
    const createPurchaseOrderPage = fileContents('app/admin/procurement/purchase-orders/create/page.tsx')
    const purchaseOrderDetailPage = fileContents('app/admin/procurement/purchase-orders/[id]/page.tsx')

    expect(createPurchaseOrderPage).not.toContain('/admin/procurement/purchase-orders')
    expect(purchaseOrderDetailPage).not.toContain('/admin/procurement/purchase-orders')
  })
})
