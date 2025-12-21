import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './BarangNewClient'

export default async function Page() {
    await ensurePermission('barang:create')
    return <ClientComponent />
}
