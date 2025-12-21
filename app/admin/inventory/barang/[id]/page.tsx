import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './BarangDetailClient'

export default async function Page() {
    await ensurePermission('barang:read')
    return <ClientComponent />
}
