import { ensurePermission } from '@/lib/rbac'
import BarangList from './BarangList'

export const dynamic = 'force-dynamic'

export default async function BarangPage() {
    await ensurePermission('barang:read')

    return <BarangList />
}
